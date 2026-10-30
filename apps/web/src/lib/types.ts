export interface DeckCounts {
  total: number;
  due: number;
  new: number;
  learned: number;
}

export interface DeckSummary {
  id: number;
  name: string;
  description: string;
  created_at: string;
  counts: DeckCounts;
}

export interface Card {
  id: number;
  deck_id: number;
  front: string;
  back: string;
  created_at: string;
  due_on: string;
  interval_days: number;
  ease: number;
  repetitions: number;
}

export interface DeckDetail extends DeckSummary {
  cards: Card[];
}

export interface StudyCard extends Card {
  is_new: boolean;
  previews: Record<'1' | '3' | '4' | '5', number>;
}

export interface StudyQueue {
  deck: { id: number; name: string };
  cards: StudyCard[];
}

export interface ReviewResult {
  card: Card;
  review: { id: number; card_id: number; reviewed_at: string; grade: number };
}

export interface Stats {
  reviewsPerDay: Array<{ date: string; count: number }>;
  retention: { rate: number | null; reviews: number; windowDays: number };
  streak: number;
}
