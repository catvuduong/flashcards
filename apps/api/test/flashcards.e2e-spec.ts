import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { DbService } from './../src/db.service.js';
import { FlashcardsService } from './../src/flashcards/flashcards.service.js';
import { addDays, utcToday } from './../src/flashcards/dates.js';

interface TestCard {
  id: number;
  deck_id: number;
  due_on: string;
  interval_days: number;
  ease: number;
  repetitions: number;
}

describe('flashcards API (e2e)', () => {
  let app: INestApplication<App>;
  let db: DbService;
  const today = utcToday();

  const http = () => request(app.getHttpServer());
  const createdDeckIds: number[] = [];

  async function createDeck(): Promise<{ id: number }> {
    const res = await http().post('/decks').send({ name: `e2e ${randomUUID()}` }).expect(201);
    createdDeckIds.push(res.body.id);
    return res.body;
  }

  async function deckWithCards(text: string): Promise<{ deck: { id: number }; cards: TestCard[] }> {
    const deck = await createDeck();
    const res = await http().post(`/decks/${deck.id}/cards/bulk`).send({ text }).expect(201);
    return { deck, cards: res.body.cards };
  }

  // Puts a card into a non-new state with a chosen due date, bypassing the review endpoint.
  async function schedule(cardId: number, dueOn: string, intervalDays: number, repetitions: number) {
    await db.query('UPDATE cards SET due_on = $2::date, interval_days = $3, repetitions = $4 WHERE id = $1', [
      cardId,
      dueOn,
      intervalDays,
      repetitions,
    ]);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    db = app.get(DbService);
  });

  afterAll(async () => {
    for (const id of createdDeckIds) await http().delete(`/decks/${id}`).expect(204);
    await app.close();
  });

  it('study queue lists due and new cards, oldest due first, and leaves out future cards', async () => {
    const { deck, cards } = await deckWithCards('overdue | 1\nyesterday | 2\nlater | 3\nnew | 4');
    const [overdue, yesterday, later, fresh] = cards;
    await schedule(overdue.id, addDays(today, -3), 1, 1);
    await schedule(yesterday.id, addDays(today, -1), 1, 1);
    await schedule(later.id, addDays(today, 5), 5, 1);

    const res = await http().get(`/decks/${deck.id}/study`).expect(200);

    expect(res.body.cards.map((card: TestCard) => card.id)).toEqual([overdue.id, yesterday.id, fresh.id]);
    expect(res.body.cards.map((card: { is_new: boolean }) => card.is_new)).toEqual([false, false, true]);
  });

  it('study queue returns at most 20 cards', async () => {
    const text = Array.from({ length: 25 }, (_, i) => `q${i} | a${i}`).join('\n');
    const { deck } = await deckWithCards(text);

    const res = await http().get(`/decks/${deck.id}/study`).expect(200);

    expect(res.body.cards).toHaveLength(20);
  });

  it('a review moves the due date, updates the schedule and is recorded', async () => {
    const {
      deck,
      cards: [card],
    } = await deckWithCards('solo | card');

    const first = await http().post(`/cards/${card.id}/review`).send({ grade: 4 }).expect(201);
    expect(first.body.card).toMatchObject({ due_on: addDays(today, 1), interval_days: 1, repetitions: 1 });
    expect(first.body.review).toMatchObject({ card_id: card.id, grade: 4 });

    const second = await http().post(`/cards/${card.id}/review`).send({ grade: 5 }).expect(201);
    expect(second.body.card).toMatchObject({ due_on: addDays(today, 6), interval_days: 6, repetitions: 2 });
    expect(second.body.card.ease).toBeCloseTo(2.6, 5);

    const study = await http().get(`/decks/${deck.id}/study`).expect(200);
    expect(study.body.cards.map((c: TestCard) => c.id)).not.toContain(card.id);

    const lapse = await http().post(`/cards/${card.id}/review`).send({ grade: 1 }).expect(201);
    expect(lapse.body.card).toMatchObject({ due_on: addDays(today, 1), interval_days: 1, repetitions: 0 });
    expect(lapse.body.card.ease).toBeCloseTo(2.06, 5);
  });

  it('study previews show the next interval for each grade', async () => {
    const { deck, cards } = await deckWithCards('preview | card');
    await schedule(cards[0].id, today, 6, 2);

    const res = await http().get(`/decks/${deck.id}/study`).expect(200);

    expect(res.body.cards[0].previews).toEqual({ 1: 1, 3: 15, 4: 15, 5: 15 });
  });

  it('review rejects grades outside 0-5 and unknown cards', async () => {
    const {
      cards: [card],
    } = await deckWithCards('grade | check');

    await http().post(`/cards/${card.id}/review`).send({ grade: 6 }).expect(400);
    await http().post(`/cards/${card.id}/review`).send({}).expect(400);
    await http().post('/cards/2147483000/review').send({ grade: 4 }).expect(404);
  });

  it('bulk add creates nothing when any line is malformed', async () => {
    const deck = await createDeck();

    await http()
      .post(`/decks/${deck.id}/cards/bulk`)
      .send({ text: 'good | line\nno separator here' })
      .expect(400);

    const res = await http().get(`/decks/${deck.id}`).expect(200);
    expect(res.body.cards).toHaveLength(0);
    expect(res.body.counts.total).toBe(0);
  });

  it('deck list and deck detail report the same due, new, learned and total counts', async () => {
    const { deck, cards } = await deckWithCards('new one | a\ndue one | b\nlearned | c');
    const [, due, learned] = cards;
    await schedule(due.id, addDays(today, -1), 1, 1);
    await schedule(learned.id, addDays(today, 10), 30, 4);

    const detail = await http().get(`/decks/${deck.id}`).expect(200);
    const list = await http().get('/decks').expect(200);
    const summary = list.body.find((d: { id: number }) => d.id === deck.id);

    const expected = { total: 3, due: 1, new: 1, learned: 1 };
    expect(detail.body.counts).toEqual(expected);
    expect(summary.counts).toEqual(expected);
  });

  it('stats return 14 daily buckets and count a new review toward today', async () => {
    const before = (await http().get('/stats').expect(200)).body;
    expect(before.reviewsPerDay).toHaveLength(14);
    expect(before.reviewsPerDay.at(-1).date).toBe(today);

    const {
      cards: [card],
    } = await deckWithCards('stats | card');
    await http().post(`/cards/${card.id}/review`).send({ grade: 2 }).expect(201);

    const after = (await http().get('/stats').expect(200)).body;
    expect(after.reviewsPerDay.at(-1).count).toBe(before.reviewsPerDay.at(-1).count + 1);
    expect(after.retention.reviews).toBe(before.retention.reviews + 1);
    expect(after.retention.rate).toBeGreaterThanOrEqual(0);
    expect(after.retention.rate).toBeLessThanOrEqual(1);
    expect(after.streak).toBeGreaterThanOrEqual(1);
  });

  it('demo decks are seeded once, however often the app boots', async () => {
    await app.get(FlashcardsService).onApplicationBootstrap();

    const list = (await http().get('/decks').expect(200)).body;
    const spanish = list.filter((d: { name: string }) => d.name === 'Spanish Basics');
    expect(spanish).toHaveLength(1);
    expect(spanish[0].counts.total).toBe(12);
    expect(spanish[0].counts.due).toBeGreaterThan(0);
    expect(spanish[0].counts.new).toBeGreaterThan(0);
  });
});
