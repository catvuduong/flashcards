'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ErrorState, LoadingState } from '@/components/states';
import { api, errorMessage } from '@/lib/api';
import { formatInterval, plural } from '@/lib/format';
import { GRADES, type GradeValue } from '@/lib/grades';
import { useApi } from '@/lib/use-api';
import type { ReviewResult, StudyCard, StudyQueue } from '@/lib/types';

type Tally = Record<GradeValue, number>;

const EMPTY_TALLY: Tally = { 1: 0, 3: 0, 4: 0, 5: 0 };

export function StudySession({ id }: { id: string }) {
  // Each session fetches its own queue. Bumping `session` makes the queue reload, so the old cards never reappear.
  const [session, setSession] = useState(0);
  const { data: queue, error, loading, retry } = useApi<StudyQueue>(`/decks/${id}/study?session=${session}`);

  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [tally, setTally] = useState<Tally>(EMPTY_TALLY);
  const [busy, setBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const cards = queue?.cards ?? [];
  const current: StudyCard | undefined = cards[index];
  const done = queue !== undefined && index >= cards.length;

  const restart = useCallback(() => {
    setIndex(0);
    setFlipped(false);
    setTally(EMPTY_TALLY);
    setReviewError(null);
    setSession((n) => n + 1);
  }, []);

  const flip = useCallback(() => {
    if (current && !busy) setFlipped((value) => !value);
  }, [current, busy]);

  const grade = useCallback(
    async (value: GradeValue) => {
      if (!current || !flipped || busy) return;
      setBusy(true);
      setReviewError(null);
      try {
        await api<ReviewResult>(`/cards/${current.id}/review`, { method: 'POST', body: { grade: value } });
        setTally((t) => ({ ...t, [value]: t[value] + 1 }));
        setIndex((i) => i + 1);
        setFlipped(false);
      } catch (err) {
        setReviewError(errorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [current, flipped, busy],
  );

  // Space flips; 1-4 grade once the answer is showing.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === ' ') {
        event.preventDefault();
        flip();
        return;
      }
      const match = GRADES.find((g) => g.key === event.key);
      if (match) {
        event.preventDefault();
        void grade(match.grade);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flip, grade]);

  if (loading) return <LoadingState label="Loading session" />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!queue) return null;

  const deckHref = `/decks/${queue.deck.id}`;

  if (cards.length === 0) {
    return (
      <section className="state panel" data-testid="study-empty">
        <h2>All caught up</h2>
        <p>Nothing is due in {queue.deck.name} right now. Come back tomorrow, or add more cards.</p>
        <div className="row">
          <Link className="btn btn-primary" href={deckHref}>
            Back to deck
          </Link>
        </div>
      </section>
    );
  }

  if (done) {
    return <Summary deckName={queue.deck.name} deckHref={deckHref} tally={tally} onAgain={restart} />;
  }

  const reviewed = index;
  const percent = Math.round((reviewed / cards.length) * 100);

  return (
    <div className="study">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <Link className="btn btn-small btn-ghost" href={deckHref}>
          ← {queue.deck.name}
        </Link>
        {current?.is_new && <span className="chip chip-new">New card</span>}
      </div>

      <div className="study-progress" data-testid="study-progress">
        <div className="study-progress-label">
          <span>
            {reviewed} of {cards.length} reviewed
          </span>
          <span>{percent}%</span>
        </div>
        <div
          className="progress"
          role="progressbar"
          aria-label="Session progress"
          aria-valuemin={0}
          aria-valuemax={cards.length}
          aria-valuenow={reviewed}
        >
          <div className="progress-bar" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {current && (
        <button
          type="button"
          className="flashcard"
          data-testid="flashcard"
          aria-pressed={flipped}
          onClick={flip}
        >
          <span className="flashcard-label">{flipped ? 'Answer' : 'Question'}</span>
          <span className="flashcard-text">{flipped ? current.back : current.front}</span>
          {!flipped && <span className="flashcard-hint">Click or press Space to flip</span>}
        </button>
      )}

      {reviewError && (
        <p className="form-error" role="alert">
          {reviewError}
        </p>
      )}

      <div className="grades" role="group" aria-label="Rate your recall">
        {GRADES.map((option) => (
          <button
            key={option.grade}
            type="button"
            className={`grade grade-${option.tone}`}
            data-testid={option.testId}
            disabled={!flipped || busy}
            onClick={() => grade(option.grade)}
          >
            <strong>{option.label}</strong>
            <small>next {current ? formatInterval(current.previews[`${option.grade}`]) : '—'}</small>
            <kbd>{option.key}</kbd>
          </button>
        ))}
      </div>
    </div>
  );
}

function Summary({
  deckName,
  deckHref,
  tally,
  onAgain,
}: {
  deckName: string;
  deckHref: string;
  tally: Tally;
  onAgain: () => void;
}) {
  const total = tally[1] + tally[3] + tally[4] + tally[5];
  const recalled = tally[3] + tally[4] + tally[5];
  const recall = total === 0 ? null : Math.round((recalled / total) * 100);

  return (
    <section className="state panel" data-testid="session-summary">
      <p className="eyebrow">Session complete</p>
      <h2>{total === 0 ? 'No cards reviewed' : `${plural(total, 'card')} reviewed in ${deckName}`}</h2>
      {recall !== null && <p>{recall}% recalled</p>}
      <div className="summary-grid">
        <div>
          <strong>{tally[1]}</strong>
          <span>Again</span>
        </div>
        <div>
          <strong>{tally[3]}</strong>
          <span>Hard</span>
        </div>
        <div>
          <strong>{tally[4]}</strong>
          <span>Good</span>
        </div>
        <div>
          <strong>{tally[5]}</strong>
          <span>Easy</span>
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'center' }}>
        <Link className="btn" href={deckHref}>
          Back to deck
        </Link>
        <button type="button" className="btn btn-primary" onClick={onAgain}>
          Check for more
        </button>
      </div>
    </section>
  );
}
