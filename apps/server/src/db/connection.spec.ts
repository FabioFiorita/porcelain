import { subscribe, unsubscribe } from 'node:diagnostics_channel';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { describe, expect, it, onTestFinished } from 'vitest';
import { openDatabase, type SqlEvent } from './connection.ts';

async function open() {
  const directory = await mkdtemp(join(tmpdir(), 'porcelain-sql-'));
  onTestFinished(() => rm(directory, { recursive: true, force: true }));
  const database = openDatabase(directory);
  onTestFinished(() => {
    database.close();
  });
  return database;
}

describe('openDatabase', () => {
  it('publishes executed statements to tooling that subscribed before opening', async () => {
    const statements: string[] = [];
    const listener = (event: unknown) =>
      statements.push((event as SqlEvent).sql);
    subscribe('porcelain:sql', listener);
    const database = await open();
    statements.length = 0;
    try {
      database.db.all(sql`select 41 + 1 as answer`);
    } finally {
      unsubscribe('porcelain:sql', listener);
    }
    database.db.all(sql`select 'unobserved'`);
    expect(statements).toEqual(['select 41 + 1 as answer']);
  });

  it('installs no statement hook when nothing observes it at open', async () => {
    const database = await open();
    const statements: string[] = [];
    const listener = (event: unknown) =>
      statements.push((event as SqlEvent).sql);
    subscribe('porcelain:sql', listener);
    try {
      database.db.all(sql`select 1`);
    } finally {
      unsubscribe('porcelain:sql', listener);
    }
    expect(statements).toEqual([]);
  });
});
