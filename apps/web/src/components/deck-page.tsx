'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AddCardForm, BulkAddForm, CardList, DeckSettings } from '@/components/deck-editor';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/states';
import { api, errorMessage } from '@/lib/api';
import { plural } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import type { DeckDetail } from '@/lib/types';

export function DeckPage({ id }: { id: string }) {
  const { data: deck, error, loading, refresh, retry } = useApi<DeckDetail>(`/decks/${id}`);
  const router = useRouter();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (loading) return <LoadingState label="Loading deck" />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!deck) return null;

  const { counts } = deck;
  const studyable = counts.due + counts.new > 0;

  async function deleteDeck() {
    if (!deck || !window.confirm(`Delete “${deck.name}” and all its cards? This cannot be undone.`)) return;
    try {
      await api(`/decks/${deck.id}`, { method: 'DELETE' });
      router.push('/');
    } catch (err) {
      setDeleteError(errorMessage(err));
    }
  }

  return (
    <div className="stack">
      <PageHeader
        title={deck.name}
        action={
          <div className="row">
            <Link className={`btn ${studyable ? 'btn-primary' : ''}`} href={`/decks/${deck.id}/study`}>
              {studyable ? 'Study now' : 'Review'}
            </Link>
          </div>
        }
      >
        {deck.description || `${plural(counts.total, 'card')} in this deck`}
      </PageHeader>

      <div className="stack" style={{ gap: 12, marginTop: -12 }}>
        <DeckSettings deck={deck} onChanged={refresh} />
        <div className="row">
          <button type="button" className="btn btn-small btn-ghost btn-danger" onClick={deleteDeck}>
            Delete deck
          </button>
          {deleteError && <span className="form-error">{deleteError}</span>}
        </div>
      </div>

      <dl className="counts" aria-label="Deck counts">
        <Count label="Cards" value={counts.total} testId="count-total" />
        <Count label="Due today" value={counts.due} testId="count-due" />
        <Count label="New" value={counts.new} testId="count-new" />
        <Count label="Learned" value={counts.learned} testId="count-learned" />
      </dl>

      <section className="stack" aria-labelledby="editor-heading">
        <h2 id="editor-heading" className="sr-only">
          Add cards
        </h2>
        <div className="stack" style={{ gap: 16 }}>
          <AddCardForm deckId={deck.id} onChanged={refresh} />
          <BulkAddForm deckId={deck.id} onChanged={refresh} />
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>Cards</h2>
          <span className="muted">{plural(deck.cards.length, 'card')}</span>
        </div>
        {deck.cards.length === 0 ? (
          <EmptyState title="This deck is empty">Add cards above to start studying.</EmptyState>
        ) : (
          <CardList cards={deck.cards} onChanged={refresh} />
        )}
      </section>
    </div>
  );
}

function Count({ label, value, testId }: { label: string; value: number; testId: string }) {
  return (
    <div className="count" data-testid={testId}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
