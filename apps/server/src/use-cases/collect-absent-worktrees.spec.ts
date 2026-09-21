import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, onTestFinished } from 'vitest';
import { openDatabase } from '../db/connection.ts';
import { commentThreads } from '../db/schema/comment-threads.ts';
import { reviewedFiles } from '../db/schema/reviewed-files.ts';
import { reviews } from '../db/schema/reviews.ts';
import type { RegisteredProject } from '../models/project.ts';
import { InventoryRepository } from '../repositories/inventory-repository.ts';
import { WorktreePresenceRepository } from '../repositories/worktree-presence-repository.ts';
import {
  CollectAbsentWorktrees,
  PRESENCE_GRACE_MS,
} from './collect-absent-worktrees.ts';

const project: RegisteredProject = {
  id: 'project',
  name: 'Fixture',
  namedByOwner: false,
  commonDirectory: '/fixture/.git',
  repositoryIdentity: 'fixture',
  available: true,
};
const start = Date.parse('2026-01-01T00:00:00.000Z');
const day = 24 * 60 * 60 * 1000;

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-collect-'));
  const database = openDatabase(root);
  onTestFinished(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  new InventoryRepository(database.db).save(project);
  const presence = new WorktreePresenceRepository(database.db);
  // Review data of every shape, so a cleanup that forgets one table shows.
  for (const worktreeId of ['gone', 'kept']) {
    presence.record(worktreeId, project.id);
    database.db
      .insert(reviews)
      .values({
        worktreeId,
        revision: 1,
        publishedAt: '2026-01-01T00:00:00.000Z',
        summaryHtml: '<title>Review</title>',
        summaryToken: `summary-${worktreeId}`,
        summarySecret: 'secret',
        layers: [],
      })
      .run();
    database.db
      .insert(commentThreads)
      .values({
        id: `thread-${worktreeId}`,
        worktreeId,
        anchor: { kind: 'file', filePath: 'notes.txt' },
        resolved: false,
        revision: 1,
        lastAgentRevision: null,
        sizeBytes: 1,
      })
      .run();
    database.db
      .insert(reviewedFiles)
      .values({
        worktreeId,
        path: 'notes.txt',
        fingerprint: 'a'.repeat(64),
        reviewedAt: '2026-01-01T00:00:00.000Z',
      })
      .run();
  }
  let now = start;
  return {
    database,
    presence,
    collect: new CollectAbsentWorktrees(presence, () => now),
    at(moment: number) {
      now = moment;
    },
    /** Every worktree id that still has review data of any kind. */
    remaining() {
      const ids = [
        ...database.db.select({ id: reviews.worktreeId }).from(reviews).all(),
        ...database.db
          .select({ id: commentThreads.worktreeId })
          .from(commentThreads)
          .all(),
        ...database.db
          .select({ id: reviewedFiles.worktreeId })
          .from(reviewedFiles)
          .all(),
      ].map((row) => row.id);
      return [...new Set(ids)].sort();
    },
  };
}

describe('Collecting worktrees that stayed gone', () => {
  it('waits out the grace period, then deletes that worktree alone', async () => {
    const f = await fixture();
    f.presence.observe(project.id, ['kept'], new Date(start).toISOString());
    f.at(start + PRESENCE_GRACE_MS - day);
    expect(f.collect.execute()).toEqual({ collected: [] });
    expect(f.remaining()).toEqual(['gone', 'kept']);
    f.at(start + PRESENCE_GRACE_MS + day);
    expect(f.collect.execute()).toEqual({ collected: ['gone'] });
    expect(f.remaining()).toEqual(['kept']);
    // The presence row goes with the data, so the same id is not collected
    // again and a worktree recreated at that path starts clean.
    expect(
      f.presence.expired(new Date(start + 400 * day).toISOString()),
    ).toEqual([]);
  });

  it('starts the clock again from the absence after a worktree comes back', async () => {
    const f = await fixture();
    f.presence.observe(project.id, ['kept'], new Date(start).toISOString());
    // Listed again twenty days later: whatever the disk was doing, this is a
    // worktree that exists.
    f.presence.observe(
      project.id,
      ['kept', 'gone'],
      new Date(start + 20 * day).toISOString(),
    );
    f.presence.observe(
      project.id,
      ['kept'],
      new Date(start + 25 * day).toISOString(),
    );
    // Forty days after the first absence, but only fifteen after the one that
    // counts. Measuring from the earlier one would delete live review data.
    f.at(start + 40 * day);
    expect(f.collect.execute()).toEqual({ collected: [] });
    expect(f.remaining()).toEqual(['gone', 'kept']);
    f.at(start + 25 * day + PRESENCE_GRACE_MS + day);
    expect(f.collect.execute()).toEqual({ collected: ['gone'] });
    expect(f.remaining()).toEqual(['kept']);
  });

  it('keeps a repeated absence measured from the first one', async () => {
    const f = await fixture();
    for (let elapsed = 0; elapsed <= 40 * day; elapsed += day)
      f.presence.observe(
        project.id,
        ['kept'],
        new Date(start + elapsed).toISOString(),
      );
    // Every listing says the same thing, so the clock must not restart with
    // each one: a worktree gone for forty days is collected on day thirty.
    f.at(start + 31 * day);
    expect(f.collect.execute()).toEqual({ collected: ['gone'] });
    expect(f.remaining()).toEqual(['kept']);
  });
});
