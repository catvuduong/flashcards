'use client';

import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { dueLabel, formatInterval, todayUtc } from '@/lib/format';
import type { Card, DeckDetail } from '@/lib/types';

interface Changed {
  onChanged: () => void;
}

// Deck name and description. Saving refetches the deck so counts and headings stay in step.
export function DeckSettings({ deck, onChanged }: { deck: DeckDetail } & Changed) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(deck.name);
  const [description, setDescription] = useState(deck.description);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/decks/${deck.id}`, { method: 'PATCH', body: { name, description } });
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="row">
        <button
          type="button"
          className="btn btn-small btn-ghost"
          onClick={() => {
            setName(deck.name);
            setDescription(deck.description);
            setError(null);
            setEditing(true);
          }}
        >
          Edit name
        </button>
      </div>
    );
  }

  return (
    <form className="panel stack" onSubmit={save} aria-label="Edit deck">
      <label className="field">
        Name
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={2000} />
      </label>
      <label className="field">
        Description
        <input
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
          Save
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// Adds one card at a time.
export function AddCardForm({ deckId, onChanged }: { deckId: number } & Changed) {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/cards', { method: 'POST', body: { deck_id: deckId, front, back } });
      setFront('');
      setBack('');
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel stack" onSubmit={add} aria-label="Add a card">
      <h2>Add a card</h2>
      <div className="row">
        <label className="field">
          Front
          <input className="input" value={front} onChange={(e) => setFront(e.target.value)} required />
        </label>
        <label className="field">
          Back
          <input className="input" value={back} onChange={(e) => setBack(e.target.value)} required />
        </label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div>
        <button type="submit" className="btn btn-primary" disabled={busy || !front.trim() || !back.trim()}>
          Add card
        </button>
      </div>
    </form>
  );
}

// Pastes many cards at once: one "front | back" per line. The server validates the whole batch.
export function BulkAddForm({ deckId, onChanged }: { deckId: number } & Changed) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const lines = text.split('\n').filter((line) => line.trim()).length;

  async function add(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/decks/${deckId}/cards/bulk`, { method: 'POST', body: { text } });
      setText('');
      onChanged();
    } catch (err) {
      setError(errorMessage(err).split('; '));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel stack" onSubmit={add} aria-label="Bulk add cards">
      <div>
        <h2>Bulk add</h2>
        <p className="muted">One card per line, written as “front | back”.</p>
      </div>
      <label className="field">
        <span className="sr-only">Cards, one per line</span>
        <textarea
          className="textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'hola | hello\ngracias | thank you'}
          spellCheck={false}
        />
      </label>
      {error && (
        <div className="form-error" role="alert">
          <ul>
            {error.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={busy || lines === 0}>
          {lines > 0 ? `Add ${lines} ${lines === 1 ? 'card' : 'cards'}` : 'Add cards'}
        </button>
      </div>
    </form>
  );
}

export function CardList({ cards, onChanged }: { cards: Card[] } & Changed) {
  if (cards.length === 0) {
    return <p className="muted">No cards yet. Add one above or paste a batch.</p>;
  }

  return (
    <ul className="card-list" aria-label="Cards">
      {cards.map((card) => (
        <CardRow key={card.id} card={card} onChanged={onChanged} />
      ))}
    </ul>
  );
}

function CardRow({ card, onChanged }: { card: Card } & Changed) {
  const [editing, setEditing] = useState(false);
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isNew = card.repetitions === 0 && card.interval_days === 0;

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <li className="card-row">
        <input className="input" aria-label="Front" value={front} onChange={(e) => setFront(e.target.value)} />
        <input className="input" aria-label="Back" value={back} onChange={(e) => setBack(e.target.value)} />
        <div className="card-actions">
          <button
            type="button"
            className="btn btn-small btn-primary"
            disabled={busy || !front.trim() || !back.trim()}
            onClick={() => run(() => api(`/cards/${card.id}`, { method: 'PATCH', body: { front, back } }))}
          >
            Save
          </button>
          <button type="button" className="btn btn-small btn-ghost" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
        {error && <p className="form-error">{error}</p>}
      </li>
    );
  }

  return (
    <li className="card-row">
      <div className="side">
        <strong>{card.front}</strong>
      </div>
      <div className="side">
        <span>{card.back}</span>
        <div className="card-meta">
          {isNew ? 'New' : `${dueLabel(card.due_on, todayUtc())} · every ${formatInterval(card.interval_days)}`}
        </div>
      </div>
      <div className="card-actions">
        <button type="button" className="btn btn-small btn-ghost" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button
          type="button"
          className="btn btn-small btn-ghost btn-danger"
          disabled={busy}
          onClick={() => {
            if (window.confirm(`Delete “${card.front}”?`)) {
              void run(() => api(`/cards/${card.id}`, { method: 'DELETE' }));
            }
          }}
        >
          Delete
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </li>
  );
}
