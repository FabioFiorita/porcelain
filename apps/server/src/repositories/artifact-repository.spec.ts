import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { expect, it } from 'vitest';
import { openDatabase } from '../db/connection.ts';
import { artifactLimits } from '../models/artifact.ts';
import { ArtifactRepository } from './artifact-repository.ts';
import { ArtifactQuotaError } from './errors/artifact-quota-error.ts';

it('enforces aggregate byte and record quotas transactionally across worktrees and reclaims deleted capacity', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-artifact-quota-'));
  const database = openDatabase(root);
  const store = new ArtifactRepository(database.db);
  try {
    const content = 'x'.repeat(artifactLimits.contentBytes);
    const records = Array.from({ length: 16 }, (_, index) =>
      store.create(
        `worktree-${index}`,
        { name: 'quota', content },
        artifactLimits.contentBytes,
      ),
    );
    expect(() =>
      store.create('other', { name: 'overflow', content: 'x' }, 1),
    ).toThrow(ArtifactQuotaError);
    expect(store.list('other')).toEqual([]);
    for (const record of records)
      expect(store.delete(record.worktreeId, record.id)).toBe(true);
    const small = Array.from({ length: artifactLimits.count }, () =>
      store.create('small', { name: 'tiny', content: 'x' }, 1),
    );
    expect(() =>
      store.create('other', { name: 'overflow', content: 'x' }, 1),
    ).toThrow(ArtifactQuotaError);
    const first = small[0];
    if (!first) throw new Error('Missing fixture');
    expect(store.delete('other', first.id)).toBe(false);
    expect(store.get('other', first.id)).toBeUndefined();
    expect(store.delete('small', first.id)).toBe(true);
    expect(store.delete('small', first.id)).toBe(false);
    expect(
      store.create('other', { name: 'replacement', content: 'x' }, 1),
    ).toMatchObject({ sizeBytes: 1 });
  } finally {
    database.close();
    await rm(root, { recursive: true, force: true });
  }
});

it('keeps metadata and content consistent when SQLite aborts writes or deletion, and survives reopening', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-artifact-atomic-'));
  const database = openDatabase(root);
  try {
    const store = new ArtifactRepository(database.db);
    database.db.run(
      sql`CREATE TRIGGER reject_artifact_insert AFTER INSERT ON artifacts BEGIN SELECT RAISE(ABORT, 'interrupted insert'); END`,
    );
    expect(() =>
      store.create(
        'worktree',
        { name: 'x', content: '<script>bad()</script>' },
        22,
      ),
    ).toThrow('interrupted insert');
    expect(store.list('worktree')).toEqual([]);
    database.db.run(sql`DROP TRIGGER reject_artifact_insert`);
    const record = store.create(
      'worktree',
      { name: '../../x.html', content: 'hello' },
      5,
    );
    database.db.run(
      sql`CREATE TRIGGER reject_artifact_delete AFTER DELETE ON artifacts BEGIN SELECT RAISE(ABORT, 'interrupted delete'); END`,
    );
    expect(() => store.delete('worktree', record.id)).toThrow(
      'interrupted delete',
    );
    expect(store.get('worktree', record.id)).toEqual({
      ...record,
      content: 'hello',
    });
    database.db.run(sql`DROP TRIGGER reject_artifact_delete`);
    database.close();
    const reopened = openDatabase(root);
    try {
      const persisted = new ArtifactRepository(reopened.db);
      expect(persisted.get('worktree', record.id)).toEqual({
        ...record,
        content: 'hello',
      });
      expect(persisted.delete('worktree', record.id)).toBe(true);
      expect(persisted.list('worktree')).toEqual([]);
      expect(persisted.get('worktree', record.id)).toBeUndefined();
    } finally {
      reopened.close();
    }
  } finally {
    database.close();
    await rm(root, { recursive: true, force: true });
  }
});
