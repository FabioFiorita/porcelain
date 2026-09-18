import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { openDatabase } from '../db/connection.ts';
import type { ReviewLayer } from '../models/review-layers.ts';
import { ReviewLayerConflictError } from './errors/review-layer-conflict-error.ts';
import { InventoryRepository } from './inventory-repository.ts';
import { ReviewLayerRepository } from './review-layer-repository.ts';

it('persists nested guides and protects them with the layer revision', async () => {
  const root = await mkdtemp(join(tmpdir(), 'guided-layer-store-'));
  const first = openDatabase(root);
  const second = openDatabase(root);
  try {
    const worktreeId = randomUUID();
    new InventoryRepository(first.db).save({
      id: randomUUID(),
      name: 'fixture',
      commonDirectory: '/fixture/.git',
      repositoryIdentity: 'fixture',
      available: true,
      worktrees: [
        {
          id: worktreeId,
          path: '/fixture',
          metadataIdentity: 'worktree',
          main: true,
          branch: null,
          available: true,
        },
      ],
    });
    const source = {
      path: 'unchanged.ts',
      startLine: 2,
      endLine: 4,
      contentFingerprint: 'a'.repeat(64),
    };
    const layer: ReviewLayer = {
      id: randomUUID(),
      title: 'Behavior',
      files: [{ path: 'changed.ts', scope: 'unstaged' }],
      guide: {
        purpose: 'Follow the behavior through unchanged context.',
        steps: [
          {
            id: randomUUID(),
            title: 'Read state',
            question: 'Which state survives?',
            source,
            verification: 'Restart and inspect the restored answer.',
            related: [{ title: 'Reference', source }],
          },
        ],
      },
    };
    const writer = new ReviewLayerRepository(first.db);
    const reader = new ReviewLayerRepository(second.db);
    writer.replace(worktreeId, 0, [layer]);
    expect(reader.read(worktreeId).layers).toEqual([layer]);
    expect(() => reader.replace(worktreeId, 0, [])).toThrow(
      ReviewLayerConflictError,
    );
    expect(reader.read(worktreeId).layers[0]?.guide).toEqual(layer.guide);
    writer.replace(worktreeId, 1, [{ ...layer, guide: undefined }]);
    expect(reader.read(worktreeId).layers[0]?.guide).toBeUndefined();
    expect(reader.read(worktreeId).revision).toBe(2);
  } finally {
    second.close();
    first.close();
    await rm(root, { recursive: true, force: true });
  }
});
