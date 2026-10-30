import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { DbService } from '../db.service.js';
import { addDays, currentStreak, startOfUtcDay, utcToday } from './dates.js';
import { buildDemoDecks } from './demo-data.js';
import { MAX_FIELD_LENGTH, parseBulkCards } from './parse-cards.js';
import { LEARNED_INTERVAL_DAYS, NEW_SCHEDULE, Schedule, previewIntervals, sm2 } from './sm2.js';

const STUDY_LIMIT = 20;
const REVIEW_WINDOW_DAYS = 30;
const CHART_DAYS = 14;
const PASSING_GRADE = 3;

// A card is new until it has been graded once; a failed grade leaves interval_days at 1, so it stays out of "new".
const IS_NEW = 'repetitions = 0 AND interval_days = 0';
const CARD_COLUMNS = `id, deck_id, front, back, created_at, to_char(due_on, 'YYYY-MM-DD') AS due_on, interval_days, ease::float8 AS ease, repetitions`;

export interface DeckRow {
  id: number;
  name: string;
  description: string;
  created_at: Date;
}

export interface CardRow {
  id: number;
  deck_id: number;
  front: string;
  back: string;
  created_at: Date;
  due_on: string;
  interval_days: number;
  ease: number;
  repetitions: number;
}

export interface DeckCounts {
  total: number;
  due: number;
  new: number;
  learned: number;
}

export interface DeckWithCounts extends DeckRow {
  counts: DeckCounts;
}

interface CountRow {
  total: number;
  due: number;
  new: number;
  learned: number;
}

export interface ReviewRow {
  id: number;
  card_id: number;
  reviewed_at: Date;
  grade: number;
}

export interface StatsResponse {
  reviewsPerDay: Array<{ date: string; count: number }>;
  retention: { rate: number | null; reviews: number; windowDays: number };
  streak: number;
}

function scheduleOf(card: CardRow): Schedule {
  return { intervalDays: card.interval_days, ease: card.ease, repetitions: card.repetitions };
}

function countsFrom(row: CountRow): DeckCounts {
  return { total: row.total, due: row.due, new: row.new, learned: row.learned };
}

function requireText(value: unknown, field: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new BadRequestException(`${field} is required`);
  if (text.length > MAX_FIELD_LENGTH) {
    throw new BadRequestException(`${field} must be ${MAX_FIELD_LENGTH} characters or fewer`);
  }
  return text;
}

function optionalText(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new BadRequestException(`${field} must be a string`);
  const text = value.trim();
  if (text.length > MAX_FIELD_LENGTH) {
    throw new BadRequestException(`${field} must be ${MAX_FIELD_LENGTH} characters or fewer`);
  }
  return text;
}

export function parseGrade(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 5) {
    throw new BadRequestException('grade must be an integer from 0 to 5');
  }
  return value;
}

// Shared by the deck list and the deck detail page, so both agree on what "due" and "new" mean.
const DECK_COUNTS_SQL = `
  SELECT d.id, d.name, d.description, d.created_at,
    count(c.id)::int AS total,
    count(c.id) FILTER (WHERE NOT (${IS_NEW}) AND c.due_on <= $1::date)::int AS due,
    count(c.id) FILTER (WHERE ${IS_NEW})::int AS new,
    count(c.id) FILTER (WHERE c.interval_days >= ${LEARNED_INTERVAL_DAYS})::int AS learned
  FROM decks d
  LEFT JOIN cards c ON c.deck_id = d.id
`;

@Injectable()
export class FlashcardsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(FlashcardsService.name);

  constructor(private readonly db: DbService) {}

  // Demo decks make the dashboard look used on first load. Seeding is idempotent, so every boot is safe.
  async onApplicationBootstrap(): Promise<void> {
    if (!this.db.enabled) return;
    try {
      await this.seedDemoDecks(utcToday());
    } catch (err) {
      this.logger.warn(`demo decks not seeded: ${(err as Error).message}`);
    }
  }

  async listDecks(today = utcToday()): Promise<DeckWithCounts[]> {
    const rows = await this.db.query<DeckRow & CountRow>(`${DECK_COUNTS_SQL} GROUP BY d.id ORDER BY d.id`, [today]);
    return rows.map(toDeckWithCounts);
  }

  async createDeck(body: { name?: unknown; description?: unknown }): Promise<DeckRow> {
    const name = requireText(body?.name, 'name');
    const description = optionalText(body?.description, 'description') ?? '';
    const [deck] = await this.db.query<DeckRow>(
      'INSERT INTO decks (name, description) VALUES ($1, $2) RETURNING id, name, description, created_at',
      [name, description],
    );
    return deck;
  }

  async getDeck(id: number, today = utcToday()) {
    const [deck] = await this.db.query<DeckRow & CountRow>(
      `${DECK_COUNTS_SQL} WHERE d.id = $2 GROUP BY d.id`,
      [today, id],
    );
    if (!deck) throw new NotFoundException(`deck ${id} not found`);
    const cards = await this.db.query<CardRow>(`SELECT ${CARD_COLUMNS} FROM cards WHERE deck_id = $1 ORDER BY id`, [id]);
    return { ...toDeckWithCounts(deck), cards };
  }

  async updateDeck(id: number, body: { name?: unknown; description?: unknown }): Promise<DeckRow> {
    const name = body?.name === undefined ? undefined : requireText(body.name, 'name');
    const description = optionalText(body?.description, 'description');
    if (name === undefined && description === undefined) {
      throw new BadRequestException('nothing to update: send name or description');
    }
    const [deck] = await this.db.query<DeckRow>(
      `UPDATE decks SET name = COALESCE($2, name), description = COALESCE($3, description)
       WHERE id = $1 RETURNING id, name, description, created_at`,
      [id, name ?? null, description ?? null],
    );
    if (!deck) throw new NotFoundException(`deck ${id} not found`);
    return deck;
  }

  async deleteDeck(id: number): Promise<void> {
    const rows = await this.db.query<{ id: number }>('DELETE FROM decks WHERE id = $1 RETURNING id', [id]);
    if (rows.length === 0) throw new NotFoundException(`deck ${id} not found`);
  }

  async createCard(body: { deck_id?: unknown; front?: unknown; back?: unknown }, today = utcToday()): Promise<CardRow> {
    const deckId = Number(body?.deck_id);
    if (!Number.isInteger(deckId) || deckId < 1) throw new BadRequestException('deck_id is required');
    const front = requireText(body.front, 'front');
    const back = requireText(body.back, 'back');
    await this.assertDeckExists(deckId);
    const [card] = await this.db.query<CardRow>(
      `INSERT INTO cards (deck_id, front, back, created_at, due_on, interval_days, ease, repetitions)
       VALUES ($1, $2, $3, now(), $4::date, $5, $6, $7)
       RETURNING ${CARD_COLUMNS}`,
      [deckId, front, back, today, NEW_SCHEDULE.intervalDays, NEW_SCHEDULE.ease, NEW_SCHEDULE.repetitions],
    );
    return card;
  }

  async bulkAddCards(deckId: number, text: unknown, today = utcToday()): Promise<{ created: number; cards: CardRow[] }> {
    if (typeof text !== 'string' || !text.trim()) throw new BadRequestException('text is required');
    const { cards: parsed, errors } = parseBulkCards(text);
    if (errors.length > 0) throw new BadRequestException(errors);
    if (parsed.length === 0) throw new BadRequestException('no cards found: use one "front | back" per line');
    await this.assertDeckExists(deckId);

    const cards = await this.db.transaction(async (query) => {
      const created: CardRow[] = [];
      for (const card of parsed) {
        const [row] = await query<CardRow>(
          `INSERT INTO cards (deck_id, front, back, created_at, due_on, interval_days, ease, repetitions)
           VALUES ($1, $2, $3, now(), $4::date, $5, $6, $7)
           RETURNING ${CARD_COLUMNS}`,
          [deckId, card.front, card.back, today, NEW_SCHEDULE.intervalDays, NEW_SCHEDULE.ease, NEW_SCHEDULE.repetitions],
        );
        created.push(row);
      }
      return created;
    });
    return { created: cards.length, cards };
  }

  async updateCard(id: number, body: { front?: unknown; back?: unknown }): Promise<CardRow> {
    const front = body?.front === undefined ? undefined : requireText(body.front, 'front');
    const back = body?.back === undefined ? undefined : requireText(body.back, 'back');
    if (front === undefined && back === undefined) {
      throw new BadRequestException('nothing to update: send front or back');
    }
    const [card] = await this.db.query<CardRow>(
      `UPDATE cards SET front = COALESCE($2, front), back = COALESCE($3, back)
       WHERE id = $1 RETURNING ${CARD_COLUMNS}`,
      [id, front ?? null, back ?? null],
    );
    if (!card) throw new NotFoundException(`card ${id} not found`);
    return card;
  }

  async deleteCard(id: number): Promise<void> {
    const rows = await this.db.query<{ id: number }>('DELETE FROM cards WHERE id = $1 RETURNING id', [id]);
    if (rows.length === 0) throw new NotFoundException(`card ${id} not found`);
  }

  // Cards due today or earlier, plus new cards, oldest due date first.
  async studyQueue(deckId: number, today = utcToday()) {
    const deck = await this.getDeckRow(deckId);
    const cards = await this.db.query<CardRow>(
      `SELECT ${CARD_COLUMNS} FROM cards
       WHERE deck_id = $1 AND (due_on <= $2::date OR (${IS_NEW}))
       ORDER BY due_on ASC, id ASC
       LIMIT ${STUDY_LIMIT}`,
      [deckId, today],
    );
    return {
      deck: { id: deck.id, name: deck.name },
      cards: cards.map((card) => ({
        ...card,
        is_new: card.repetitions === 0 && card.interval_days === 0,
        previews: previewIntervals(scheduleOf(card)),
      })),
    };
  }

  // Applies SM-2 and records the review in one transaction, so a card never has a schedule without its history.
  async review(cardId: number, grade: number, now = new Date()): Promise<{ card: CardRow; review: ReviewRow }> {
    const today = utcToday(now);
    return this.db.transaction(async (query) => {
      const [current] = await query<CardRow>(`SELECT ${CARD_COLUMNS} FROM cards WHERE id = $1 FOR UPDATE`, [cardId]);
      if (!current) throw new NotFoundException(`card ${cardId} not found`);

      const next = sm2(scheduleOf(current), grade);
      const [card] = await query<CardRow>(
        `UPDATE cards SET interval_days = $2, ease = $3, repetitions = $4, due_on = $5::date
         WHERE id = $1 RETURNING ${CARD_COLUMNS}`,
        [cardId, next.intervalDays, next.ease, next.repetitions, addDays(today, next.intervalDays)],
      );
      const [review] = await query<ReviewRow>(
        'INSERT INTO reviews (card_id, reviewed_at, grade) VALUES ($1, $2, $3) RETURNING id, card_id, reviewed_at, grade',
        [cardId, now.toISOString(), grade],
      );
      return { card, review };
    });
  }

  async stats(today = utcToday()): Promise<StatsResponse> {
    const chartStart = startOfUtcDay(addDays(today, -(CHART_DAYS - 1)));
    const windowStart = startOfUtcDay(addDays(today, -(REVIEW_WINDOW_DAYS - 1)));

    const [daily, retention, days] = await Promise.all([
      this.db.query<{ day: string; count: number }>(
        `SELECT to_char(reviewed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*)::int AS count
         FROM reviews WHERE reviewed_at >= $1::timestamptz GROUP BY day`,
        [chartStart],
      ),
      this.db.query<{ passed: number; total: number }>(
        `SELECT count(*) FILTER (WHERE grade >= $2)::int AS passed, count(*)::int AS total
         FROM reviews WHERE reviewed_at >= $1::timestamptz`,
        [windowStart, PASSING_GRADE],
      ),
      this.db.query<{ day: string }>(
        `SELECT DISTINCT to_char(reviewed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day FROM reviews`,
      ),
    ]);

    const countByDay = new Map(daily.map((row) => [row.day, row.count]));
    const reviewsPerDay = Array.from({ length: CHART_DAYS }, (_, i) => {
      const date = addDays(today, i - (CHART_DAYS - 1));
      return { date, count: countByDay.get(date) ?? 0 };
    });

    const window = retention[0] ?? { passed: 0, total: 0 };
    return {
      reviewsPerDay,
      retention: {
        rate: window.total === 0 ? null : window.passed / window.total,
        reviews: window.total,
        windowDays: REVIEW_WINDOW_DAYS,
      },
      streak: currentStreak(new Set(days.map((row) => row.day)), today),
    };
  }

  private async getDeckRow(id: number): Promise<DeckRow> {
    const [deck] = await this.db.query<DeckRow>('SELECT id, name, description, created_at FROM decks WHERE id = $1', [id]);
    if (!deck) throw new NotFoundException(`deck ${id} not found`);
    return deck;
  }

  private async assertDeckExists(id: number): Promise<void> {
    await this.getDeckRow(id);
  }

  private async seedDemoDecks(today: string): Promise<void> {
    await this.db.transaction(async (query) => {
      // Serialize concurrent boots (parallel test files, serverless cold starts) so no deck is inserted twice.
      await query('SELECT pg_advisory_xact_lock(727275)');

      for (const deck of buildDemoDecks(today)) {
        const existing = await query<{ id: number }>('SELECT id FROM decks WHERE name = $1', [deck.name]);
        if (existing.length > 0) continue;

        const [{ id: deckId }] = await query<{ id: number }>(
          'INSERT INTO decks (name, description, created_at) VALUES ($1, $2, $3) RETURNING id',
          [deck.name, deck.description, deck.createdAt],
        );

        for (const card of deck.cards) {
          const [{ id: cardId }] = await query<{ id: number }>(
            `INSERT INTO cards (deck_id, front, back, created_at, due_on, interval_days, ease, repetitions)
             VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8) RETURNING id`,
            [deckId, card.front, card.back, card.createdAt, card.dueOn, card.intervalDays, card.ease, card.repetitions],
          );
          for (const review of card.reviews) {
            await query(
              'INSERT INTO reviews (card_id, reviewed_at, grade) VALUES ($1, $2, $3)',
              [cardId, review.reviewedAt, review.grade],
            );
          }
        }
      }
    });
  }
}

function toDeckWithCounts(row: DeckRow & CountRow): DeckWithCounts {
  const { id, name, description, created_at } = row;
  return { id, name, description, created_at, counts: countsFrom(row) };
}
