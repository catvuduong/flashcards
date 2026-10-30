import { addDays, startOfUtcDay } from './dates.js';
import { LEARNED_INTERVAL_DAYS, NEW_SCHEDULE, sm2 } from './sm2.js';

export interface DemoReview {
  reviewedAt: string;
  grade: number;
}

export interface DemoCard {
  front: string;
  back: string;
  createdAt: string;
  dueOn: string;
  intervalDays: number;
  ease: number;
  repetitions: number;
  reviews: DemoReview[];
}

export interface DemoDeck {
  name: string;
  description: string;
  createdAt: string;
  cards: DemoCard[];
}

const HISTORY_DAYS = 30;
const NEW_CARDS_PER_DECK = 4;

const DECK_SOURCES: Array<Pick<DemoDeck, 'name' | 'description'> & { pairs: Array<[string, string]> }> = [
  {
    name: 'Spanish Basics',
    description: 'Everyday words and phrases to get you talking.',
    pairs: [
      ['hola', 'hello'],
      ['gracias', 'thank you'],
      ['por favor', 'please'],
      ['buenos días', 'good morning'],
      ['¿cómo estás?', 'how are you?'],
      ['agua', 'water'],
      ['casa', 'house'],
      ['perro', 'dog'],
      ['libro', 'book'],
      ['comer', 'to eat'],
      ['hablar', 'to speak'],
      ['biblioteca', 'library'],
    ],
  },
  {
    name: 'JavaScript Concepts',
    description: 'Core language ideas, one question at a time.',
    pairs: [
      ['What does typeof null return?', '"object", a long-standing quirk of the language'],
      ['What is a closure?', 'A function that remembers variables from the scope where it was created'],
      ['How do const and let differ?', 'const cannot be reassigned; let can'],
      ['What does Array.prototype.map return?', 'A new array of the same length'],
      ['What is hoisting?', 'Declarations are processed before code in their scope runs'],
      ['How do == and === differ?', '== converts types before comparing; === does not'],
      ['What is a Promise?', 'An object representing a value that is available now, later, or never'],
      ['What is event delegation?', 'One listener on a parent handles events from its children'],
      ['What does Object.freeze do?', 'Stops adding, removing or changing own properties (shallow)'],
      ['What is the event loop?', 'The mechanism that runs queued callbacks once the call stack is empty'],
      ['What does JSON.parse do?', 'Turns a JSON string into a JavaScript value'],
      ['What does this refer to in an arrow function?', 'The this of the enclosing scope'],
    ],
  },
];

// Small deterministic PRNG (mulberry32) so the same day always produces the same history.
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Replays SM-2 over a made-up review history that ends before `today`. Cards whose next review
// falls on or after today are due today or later, so the dashboard shows a realistic mix of
// due, new, and learned cards.
function reviewHistory(random: () => number, today: string, firstReviewOffset: number) {
  const reviews: DemoReview[] = [];
  let schedule = NEW_SCHEDULE;
  let offset = firstReviewOffset;

  while (offset < 0) {
    // Mostly good answers, with the occasional slip that resets the interval.
    const roll = random();
    const grade = roll < 0.12 ? 1 : roll < 0.3 ? 3 : roll < 0.7 ? 4 : 5;
    const day = addDays(today, offset);
    const hour = 8 + Math.floor(random() * 12);
    const minute = Math.floor(random() * 60);
    reviews.push({
      reviewedAt: `${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`,
      grade,
    });
    schedule = sm2(schedule, grade);
    offset += schedule.intervalDays;
  }

  return { reviews, schedule, dueOn: addDays(today, offset) };
}

type History = ReturnType<typeof reviewHistory> & { firstReviewOffset: number };

// Varies the start day and the random stream until a history meets `goal`, so the demo has due and learned
// cards on first load. The search is deterministic; if nothing matches, the first attempt is used.
function historyFor(seed: number, today: string, goal: (history: History) => boolean): History {
  const attempts = Array.from({ length: 200 }, (_, attempt): History => {
    const firstReviewOffset = -HISTORY_DAYS + (attempt % (HISTORY_DAYS - 6));
    return { ...reviewHistory(prng(seed + attempt), today, firstReviewOffset), firstReviewOffset };
  });
  return attempts.find(goal) ?? attempts[0];
}

// Builds the two demo decks for `today` (UTC). Pure and deterministic: the same day gives the same data.
export function buildDemoDecks(today: string): DemoDeck[] {
  return DECK_SOURCES.map((source, deckIndex) => {
    const deckCreatedAt = addDays(today, -(HISTORY_DAYS + 1));
    const reviewedCount = source.pairs.length - NEW_CARDS_PER_DECK;

    const cards = source.pairs.map(([front, back], cardIndex): DemoCard => {
      if (cardIndex >= reviewedCount) {
        return {
          front,
          back,
          createdAt: startOfUtcDay(addDays(today, cardIndex + 1 - source.pairs.length)),
          dueOn: today,
          intervalDays: 0,
          ease: NEW_SCHEDULE.ease,
          repetitions: 0,
          reviews: [],
        };
      }

      // Every third card is due today, every third (offset by one) is learned, the rest are mid-schedule.
      const goal =
        cardIndex % 3 === 1
          ? (history: History) => history.dueOn === today
          : cardIndex % 3 === 0
            ? (history: History) => history.schedule.intervalDays >= LEARNED_INTERVAL_DAYS
            : () => true;
      const seed = deckIndex * 1000 + cardIndex + 1;
      const { reviews, schedule, dueOn, firstReviewOffset } = historyFor(seed, today, goal);

      return {
        front,
        back,
        createdAt: startOfUtcDay(addDays(today, firstReviewOffset - 1)),
        dueOn,
        intervalDays: schedule.intervalDays,
        ease: schedule.ease,
        repetitions: schedule.repetitions,
        reviews,
      };
    });

    return { name: source.name, description: source.description, createdAt: startOfUtcDay(deckCreatedAt), cards };
  });
}
