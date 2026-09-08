import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { openDatabase } from '../db/connection.ts';
import { ReviewLayerConflictError } from './errors/review-layer-conflict-error.ts';
import { UnknownWorktreeError } from './errors/unknown-worktree-error.ts';
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
      commonDirectory: '/fixture/.git',
      repositoryIdentity: 'fixture',
      available: true,
      worktrees: [
        {
          id,
          path: '/fixture',
          metadataIdentity: 'worktree',
          main: true,
          branch: null,
          available: true,
        },
      ],
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
    inventory.save({ ...project, worktrees: [] });
    expect(b.read(id)).toEqual(saved);
    expect(() => b.replace(randomUUID(), 0, [])).toThrow(UnknownWorktreeError);
  } finally {
    second.close();
    first.close();
    await rm(root, { recursive: true, force: true });
  }
});
