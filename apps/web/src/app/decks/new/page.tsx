'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { PageHeader } from '@/components/states';
import { api, errorMessage } from '@/lib/api';

export default function NewDeckPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const deck = await api<{ id: number }>('/decks', { method: 'POST', body: { name, description } });
      router.push(`/decks/${deck.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="New deck">A deck groups cards on one topic.</PageHeader>
      <form className="panel stack" onSubmit={create} style={{ maxWidth: 560 }}>
        <label className="field">
          Name
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Spanish Basics"
            required
            maxLength={2000}
            autoFocus
          />
        </label>
        <label className="field">
          Description <span className="muted">(optional)</span>
          <input
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Everyday words and phrases"
            maxLength={2000}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="row">
          <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
            {busy ? 'Creating…' : 'Create deck'}
          </button>
          <Link className="btn btn-ghost" href="/">
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
