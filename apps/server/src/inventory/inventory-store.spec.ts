import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, it } from 'vitest';
import { openInventoryStore } from './inventory-store.ts';

it('rejects a newer schema without changing its version or data', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'porcelain-schema-'));
  try {
    const path = join(directory, 'inventory.sqlite');
    const database = new DatabaseSync(path);
    database.exec(
      "PRAGMA user_version = 2; CREATE TABLE future (value TEXT); INSERT INTO future VALUES ('preserve');",
    );
    database.close();
    expect(() => openInventoryStore(directory)).toThrow(
      'Unsupported inventory database version',
    );
    const reopened = new DatabaseSync(path);
    try {
      expect(reopened.prepare('PRAGMA user_version').get()?.user_version).toBe(
        2,
      );
      expect(reopened.prepare('SELECT value FROM future').get()?.value).toBe(
        'preserve',
      );
    } finally {
      reopened.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('requires an explicit absolute data directory', () => {
  expect(() => openInventoryStore('relative')).toThrow(
    'absolute data directory',
  );
});
