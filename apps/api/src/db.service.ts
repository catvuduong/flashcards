import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

// Add new tables here as extra statements; they are all created once, behind a lock.
const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS items (id SERIAL PRIMARY KEY, title TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now())',
  "CREATE TABLE IF NOT EXISTS decks (id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now())",
  'CREATE TABLE IF NOT EXISTS cards (id SERIAL PRIMARY KEY, deck_id INT NOT NULL REFERENCES decks(id) ON DELETE CASCADE, front TEXT NOT NULL, back TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), due_on DATE NOT NULL, interval_days INT NOT NULL DEFAULT 0, ease NUMERIC NOT NULL DEFAULT 2.5, repetitions INT NOT NULL DEFAULT 0)',
  'CREATE INDEX IF NOT EXISTS cards_deck_due_idx ON cards (deck_id, due_on)',
  'CREATE TABLE IF NOT EXISTS reviews (id SERIAL PRIMARY KEY, card_id INT NOT NULL REFERENCES cards(id) ON DELETE CASCADE, reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(), grade INT NOT NULL CHECK (grade BETWEEN 0 AND 5))',
  'CREATE INDEX IF NOT EXISTS reviews_reviewed_at_idx ON reviews (reviewed_at)',
];

export type Query = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

@Injectable()
export class DbService implements OnModuleDestroy {
  private readonly pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL, max: 3 })
    : null;
  private ready: Promise<void> | null = null;

  get enabled(): boolean {
    return this.pool !== null;
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (!this.pool) throw new Error('DATABASE_URL is not set');
    await this.ensureSchema();
    const res = await this.pool.query(sql, params);
    return res.rows as T[];
  }

  // Runs every query issued through `query` on one connection, committing only if `fn` resolves.
  async transaction<T>(fn: (query: Query) => Promise<T>): Promise<T> {
    if (!this.pool) throw new Error('DATABASE_URL is not set');
    await this.ensureSchema();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const query: Query = async <R>(sql: string, params: unknown[] = []) =>
        (await client.query(sql, params)).rows as R[];
      const result = await fn(query);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  private ensureSchema(): Promise<void> {
    this.ready ??= (async () => {
      // Concurrent instances (serverless cold starts, parallel test files) race on CREATE TABLE IF NOT EXISTS,
      // so serialize schema setup behind a transaction-scoped advisory lock.
      const client = await this.pool!.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(727274)');
        for (const statement of SCHEMA) await client.query(statement);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        this.ready = null;
        throw err;
      } finally {
        client.release();
      }
    })();
    return this.ready;
  }
}
