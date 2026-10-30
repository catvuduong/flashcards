'use client';

import Link from 'next/link';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/states';
import { plural } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import type { DeckSummary } from '@/lib/types';

export default function DecksPage() {
  const { data: decks, error, loading, retry } = useApi<DeckSummary[]>('/decks');

  const dueTotal = decks?.reduce((sum, deck) => sum + deck.counts.due, 0) ?? 0;
  const newTotal = decks?.reduce((sum, deck) => sum + deck.counts.new, 0) ?? 0;

  return (
    <>
      <PageHeader
        title="Your decks"
        action={
          <Link className="btn btn-primary" href="/decks/new">
            New deck
          </Link>
        }
      >
        {decks && decks.length > 0
          ? `${plural(dueTotal, 'card')} due today, ${newTotal} new`
          : 'Spaced repetition: review each card just before you would forget it.'}
      </PageHeader>

      {loading && <LoadingState label="Loading decks" />}
      {error && <ErrorState message={error} onRetry={retry} />}

      {decks && decks.length === 0 && (
        <EmptyState
          title="No decks yet"
          action={
            <Link className="btn btn-primary" href="/decks/new">
              Create your first deck
            </Link>
          }
        >
          A deck is a set of cards about one topic. Add a few and come back to study.
        </EmptyState>
      )}

      {decks && decks.length > 0 && (
        <ul className="deck-grid">
          {decks.map((deck) => (
            <li key={deck.id}>
              <DeckCard deck={deck} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function DeckCard({ deck }: { deck: DeckSummary }) {
  const { counts } = deck;
  const learnedShare = counts.total === 0 ? 0 : (counts.learned / counts.total) * 100;
  const studyable = counts.due + counts.new > 0;

  return (
    <article className="deck-card" data-testid="deck-card">
      <div className="stack" style={{ gap: 6 }}>
        <h2>
          <Link href={`/decks/${deck.id}`}>{deck.name}</Link>
        </h2>
        {deck.description && <p>{deck.description}</p>}
      </div>

      <div className="chips">
        <span className={`chip ${counts.due > 0 ? 'chip-due' : ''}`} data-testid="deck-due">
          {counts.due} due
        </span>
        <span className={`chip ${counts.new > 0 ? 'chip-new' : ''}`} data-testid="deck-new">
          {counts.new} new
        </span>
        <span className="chip">{plural(counts.total, 'card')}</span>
      </div>

      <div
        className="progress"
        role="progressbar"
        aria-label={`${deck.name} learned`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(learnedShare)}
      >
        <div className="progress-bar" style={{ width: `${learnedShare}%` }} />
      </div>

      <div className="card-foot">
        <span>{counts.learned} learned</span>
        <Link className={`btn btn-small ${studyable ? 'btn-primary' : ''}`} href={`/decks/${deck.id}/study`}>
          {studyable ? 'Study' : 'Review'}
        </Link>
      </div>
    </article>
  );
}
