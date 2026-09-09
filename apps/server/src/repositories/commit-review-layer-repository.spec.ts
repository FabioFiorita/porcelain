import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { openDatabase } from '../db/connection.ts';
import { CommitReviewLayerConflictError } from '../use-cases/errors/commit-review-layer-conflict-error.ts';
import { StaleReviewLayerSourceError } from '../use-cases/errors/stale-review-layer-source-error.ts';
import { WorktreeNotFoundError } from '../use-cases/errors/worktree-not-found-error.ts';
import { CommitReviewLayerRepository } from './commit-review-layer-repository.ts';
import { InventoryRepository } from './inventory-repository.ts';
import { ProjectRemovalRepository } from './project-removal-repository.ts';
import { ReviewLayerRepository } from './review-layer-repository.ts';

it('rejects source changes across connections, preserves immutable snapshots and atomically cleans only the owning project', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-commit-layer-store-'));
  const first = openDatabase(root);
  const second = openDatabase(root);
  try {
    const inventory = new InventoryRepository(first.db);
    const layers = new ReviewLayerRepository(first.db);
    const projects = ['one', 'two'].map((name) => ({
      id: randomUUID(),
      name,
      commonDirectory: `/${name}/.git`,
      repositoryIdentity: name,
      available: true,
      worktrees: [
        {
          id: randomUUID(),
          path: `/${name}`,
          metadataIdentity: name,
          main: true,
          branch: null,
          available: true,
        },
      ],
    }));
    const [project, other] = projects;
    if (!project || !other) throw new Error('Missing fixture projects');
    const source = project.worktrees[0];
    const otherSource = other.worktrees[0];
    if (!source || !otherSource) throw new Error('Missing fixture worktrees');
    const ordered = [
      {
        id: randomUUID(),
        title: 'Preserved',
        files: [{ path: 'file', scope: 'staged' as const }],
      },
    ];
    for (const owner of projects) {
      inventory.save(owner);
      layers.replace(owner.worktrees[0]?.id ?? '', 0, ordered);
    }
    const a = new CommitReviewLayerRepository(first.db);
    const b = new CommitReviewLayerRepository(second.db);
    const snapshot = {
      projectId: project.id,
      commitOid: 'a'.repeat(40),
      sourceWorktreeId: source.id,
      sourceRevision: 1,
      parentNumber: 1,
      layers: ordered,
    };
    new ReviewLayerRepository(second.db).replace(source.id, 1, ordered);
    expect(() => a.create(snapshot)).toThrow(StaleReviewLayerSourceError);
    expect(a.read(project.id, snapshot.commitOid)).toBeNull();
    const current = { ...snapshot, sourceRevision: 2 };
    const saved = a.create(current);
    expect(b.create(current)).toEqual(saved);
    expect(() => b.create({ ...current, parentNumber: 2 })).toThrow(
      CommitReviewLayerConflictError,
    );
    expect(() =>
      b.create({ ...current, commitOid: 'b'.repeat(40), projectId: other.id }),
    ).toThrow(WorktreeNotFoundError);
    const otherSnapshot = b.create({
      ...snapshot,
      projectId: other.id,
      sourceWorktreeId: otherSource.id,
    });
    layers.replace(source.id, 2, []);
    inventory.save({ ...project, worktrees: [], available: false });
    expect(b.read(project.id, snapshot.commitOid)).toEqual(saved);
    expect(b.create(current)).toEqual(saved);
    expect(new ProjectRemovalRepository(first.db).remove(project.id)).toEqual({
      deleted: true,
    });
    expect(b.read(project.id, snapshot.commitOid)).toBeNull();
    expect(b.read(other.id, snapshot.commitOid)).toEqual(otherSnapshot);
    expect(() => b.create(current)).toThrow(WorktreeNotFoundError);
  } finally {
    second.close();
    first.close();
    await rm(root, { recursive: true, force: true });
  }
});
