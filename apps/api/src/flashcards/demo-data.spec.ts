import { addDays } from './dates.js';
import { buildDemoDecks } from './demo-data.js';

const TODAY = '2026-10-30';

describe('buildDemoDecks', () => {
  const decks = buildDemoDecks(TODAY);

  it('is deterministic for a given day', () => {
    expect(buildDemoDecks(TODAY)).toEqual(decks);
  });

  it('creates two decks with about a dozen cards each', () => {
    expect(decks.map((deck) => deck.name)).toEqual(['Spanish Basics', 'JavaScript Concepts']);
    for (const deck of decks) expect(deck.cards.length).toBeGreaterThanOrEqual(10);
  });

  it.each(decks.map((deck) => [deck.name, deck] as const))(
    '%s has due, new and learned cards so the dashboard is populated',
    (_name, deck) => {
      const isNew = (card: (typeof deck.cards)[number]) => card.repetitions === 0 && card.intervalDays === 0;
      expect(deck.cards.filter(isNew).length).toBeGreaterThan(0);
      expect(deck.cards.filter((card) => !isNew(card) && card.dueOn <= TODAY).length).toBeGreaterThan(0);
      expect(deck.cards.filter((card) => card.intervalDays >= 21).length).toBeGreaterThan(0);
    },
  );

  it('keeps every review inside the last 30 days, before today', () => {
    const earliest = addDays(TODAY, -30);
    for (const card of decks.flatMap((deck) => deck.cards)) {
      for (const review of card.reviews) {
        const day = review.reviewedAt.slice(0, 10);
        expect(day >= earliest && day < TODAY).toBe(true);
      }
    }
  });

  it('keeps the card state in step with its review history', () => {
    for (const card of decks.flatMap((deck) => deck.cards)) {
      if (card.reviews.length === 0) continue;
      expect(card.dueOn >= TODAY).toBe(true);
      const times = card.reviews.map((review) => review.reviewedAt);
      expect(times).toEqual(times.toSorted());
    }
  });
});
