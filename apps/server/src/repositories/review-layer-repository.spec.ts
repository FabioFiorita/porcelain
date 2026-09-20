import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { openDatabase } from '../db/connection.ts';
import { ReviewLayerConflictError } from './errors/review-layer-conflict-error.ts';
import { InventoryRepository } from './inventory-repository.ts';
import { ReviewLayerRepository } from './review-layer-repository.ts';

it('protects revisions across SQLite connections and retains metadata after inventory replacement/removal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'layer-store-'));
  const first = openDatabase(root);
  const second = openDatabase(root);
  try {
    const inventory = new InventoryRepository(first.db);
    const id = randomUUID();
    const project = {
      id: randomUUID(),
      name: 'fixture',
      namedByOwner: false,
      commonDirectory: '/fixture/.git',
      repositoryIdentity: 'fixture',
      available: true,
    };
    inventory.save(project);
    const a = new ReviewLayerRepository(first.db);
    const b = new ReviewLayerRepository(second.db);
    expect(a.read(id).revision).toBe(0);
    expect(b.read(id).revision).toBe(0);
    const layers = [
      {
        id: randomUUID(),
        title: 'Preserved',
        files: [{ path: 'missing', scope: 'unstaged' as const }],
      },
    ];
    const saved = a.replace(id, 0, layers);
    expect(() => b.replace(id, 0, [])).toThrow(ReviewLayerConflictError);
    expect(b.read(id)).toEqual(saved);
    inventory.save(project);
    expect(b.read(id)).toEqual(saved);
    inventory.save({ ...project });
    expect(b.read(id)).toEqual(saved);
    // Whether a worktree exists is the resolver's answer, not this
    // repository's: an id it has never seen simply starts at revision zero,
    // and a stale expected revision is still a conflict.
    expect(b.replace('a'.repeat(32), 0, [])).toMatchObject({ revision: 1 });
    expect(() => b.replace('a'.repeat(32), 0, [])).toThrow(
      ReviewLayerConflictError,
    );
  } finally {
    second.close();
    first.close();
    await rm(root, { recursive: true, force: true });
  }
});
