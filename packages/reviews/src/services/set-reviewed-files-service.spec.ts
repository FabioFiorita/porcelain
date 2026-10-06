import { testClock } from '@porcelain/kernel/test-kit';
import {
  ReviewedFileStore,
  SetReviewedFilesOptions,
} from '@porcelain/reviews/ports';
import { Effect, Clock } from 'effect';
import { describe, expect, it } from 'vitest';
import { ReviewedMarkConflictError } from '@porcelain/reviews/errors';
import { type FileChange } from '@porcelain/kernel/models';
import { InMemoryReviewedFileStore } from '../../spec/fakes/in-memory-reviewed-file-store.ts';
import { SetReviewedFilesService } from './set-reviewed-files-service.ts';

const worktreeId = 'a'.repeat(64);

function changes(
  entries: readonly { path: string; fingerprint?: string }[],
): FileChange[] {
  return entries.map((entry) => ({
    path: entry.path,
    fingerprint: entry.fingerprint,
    comparisons: [],
  }));
}

async function setup() {
  const store = new InMemoryReviewedFileStore();
  const clock = await testClock('2026-01-02T00:00:00.000Z');
  return {
    store,
    service: Effect.runSync(
      SetReviewedFilesService.pipe(
        Effect.provide(SetReviewedFilesService.layer),
        Effect.provideService(ReviewedFileStore, store),
        Effect.provideService(Clock.Clock, clock),
        Effect.provideService(SetReviewedFilesOptions, {
          marksPerWorktree: 2000,
        }),
      ),
    ),
  };
}

async function marked(store: InMemoryReviewedFileStore, path: string) {
  return (await Effect.runPromise(store.list({ worktreeId }))).find(
    (mark) => mark.path === path,
  );
}

async function fill(
  store: InMemoryReviewedFileStore,
  reviewedAt: (index: number) => string,
) {
  await Effect.runPromise(
    store.save({
      worktreeId,
      marks: Array.from({ length: 2000 }, (_, index) => ({
        path: `file-${String(index).padStart(4, '0')}`,
        fingerprint: 'f',
        reviewedAt: reviewedAt(index),
        stale: false,
      })),
    }),
  );
}

describe('SetReviewedFilesService', () => {
  it('marks files whose fingerprint is current and reports the others', async () => {
    const { service } = await setup();
    const result = Effect.runSync(
      service.execute({
        worktreeId,
        files: [
          { path: 'a.txt', fingerprint: 'fa' },
          { path: 'b.txt', fingerprint: 'old' },
          { path: 'c.txt', fingerprint: 'fc' },
          { path: 'unreadable.bin', fingerprint: 'fu' },
        ],
        changes: changes([
          { path: 'a.txt', fingerprint: 'fa' },
          { path: 'b.txt', fingerprint: 'fb' },
          { path: 'unreadable.bin' },
        ]),
        onConflict: 'report',
      }),
    );
    expect(result.marked).toEqual(['a.txt']);
    expect(result.changed).toBe(true);
    expect(result.conflicts).toEqual([
      { path: 'b.txt', reason: 'stale' },
      { path: 'c.txt', reason: 'missing' },
      { path: 'unreadable.bin', reason: 'stale' },
    ]);
    expect(result.marks).toEqual([
      {
        path: 'a.txt',
        fingerprint: 'fa',
        reviewedAt: '2026-01-02T00:00:00.000Z',
      },
    ]);
  });

  it('uses the last fingerprint sent for a repeated path, in the order first sent', async () => {
    const { service } = await setup();
    const result = Effect.runSync(
      service.execute({
        worktreeId,
        files: [
          { path: 'b.txt', fingerprint: 'old' },
          { path: 'a.txt', fingerprint: 'fa' },
          { path: 'b.txt', fingerprint: 'fb' },
        ],
        changes: changes([
          { path: 'a.txt', fingerprint: 'fa' },
          { path: 'b.txt', fingerprint: 'fb' },
        ]),
        onConflict: 'report',
      }),
    );
    expect(result.marked).toEqual(['b.txt', 'a.txt']);
  });

  it('reports no change when every file conflicts', async () => {
    const { service, store } = await setup();
    const result = Effect.runSync(
      service.execute({
        worktreeId,
        files: [{ path: 'b.txt', fingerprint: 'old' }],
        changes: changes([{ path: 'b.txt', fingerprint: 'fb' }]),
        onConflict: 'report',
      }),
    );
    expect(result.changed).toBe(false);
    expect(await Effect.runPromise(store.list({ worktreeId }))).toEqual([]);
  });

  it('refuses the whole request when conflicts must not be reported', async () => {
    const { service, store } = await setup();
    expect(() =>
      Effect.runSync(
        service.execute({
          worktreeId,
          files: [{ path: 'missing.txt', fingerprint: 'fm' }],
          changes: changes([{ path: 'a.txt', fingerprint: 'fa' }]),
          onConflict: 'refuse',
        }),
      ),
    ).toThrow(ReviewedMarkConflictError);
    expect(await Effect.runPromise(store.list({ worktreeId }))).toEqual([]);
  });

  it('clears staleness when a file is marked again', async () => {
    const { service, store } = await setup();
    await Effect.runPromise(
      store.save({
        worktreeId,
        marks: [
          {
            path: 'a.txt',
            fingerprint: 'old',
            reviewedAt: '2026-01-01T00:00:00.000Z',
            stale: true,
          },
        ],
      }),
    );
    Effect.runSync(
      service.execute({
        worktreeId,
        files: [{ path: 'a.txt', fingerprint: 'fa' }],
        changes: changes([{ path: 'a.txt', fingerprint: 'fa' }]),
        onConflict: 'refuse',
      }),
    );
    expect(await marked(store, 'a.txt')).toEqual({
      path: 'a.txt',
      fingerprint: 'fa',
      reviewedAt: '2026-01-02T00:00:00.000Z',
      stale: false,
    });
  });

  it('keeps two thousand marks by evicting the oldest one, then the lowest path', async () => {
    const { service, store } = await setup();
    await fill(store, (index) =>
      index === 1500 ? '2025-01-01T00:00:00.000Z' : '2025-06-01T00:00:00.000Z',
    );
    Effect.runSync(
      service.execute({
        worktreeId,
        files: [
          { path: 'new-1', fingerprint: 'n1' },
          { path: 'new-2', fingerprint: 'n2' },
        ],
        changes: changes([
          { path: 'new-1', fingerprint: 'n1' },
          { path: 'new-2', fingerprint: 'n2' },
        ]),
        onConflict: 'report',
      }),
    );
    expect(await Effect.runPromise(store.list({ worktreeId }))).toHaveLength(
      2000,
    );
    expect(await marked(store, 'file-1500')).toBeUndefined();
    expect(await marked(store, 'file-0000')).toBeUndefined();
    expect(await marked(store, 'file-0001')).toBeDefined();
    expect(await marked(store, 'new-1')).toBeDefined();
    expect(await marked(store, 'new-2')).toBeDefined();
  });

  it('evicts nothing when a mark already present is renewed at the limit', async () => {
    const { service, store } = await setup();
    await fill(store, () => '2025-06-01T00:00:00.000Z');
    Effect.runSync(
      service.execute({
        worktreeId,
        files: [{ path: 'file-1999', fingerprint: 'g' }],
        changes: changes([{ path: 'file-1999', fingerprint: 'g' }]),
        onConflict: 'report',
      }),
    );
    expect(await Effect.runPromise(store.list({ worktreeId }))).toHaveLength(
      2000,
    );
    expect(await marked(store, 'file-0000')).toBeDefined();
  });

  it('marks a branch file without touching the worktree mark of the same path', async () => {
    const { store, service } = await setup();
    Effect.runSync(
      service.execute({
        worktreeId,
        files: [{ path: 'a.txt', fingerprint: 'worktree' }],
        changes: changes([{ path: 'a.txt', fingerprint: 'worktree' }]),
        onConflict: 'refuse',
      }),
    );
    const result = Effect.runSync(
      service.execute({
        worktreeId,
        scope: 'branch',
        files: [{ path: 'a.txt', fingerprint: 'branch' }],
        changes: changes([{ path: 'a.txt', fingerprint: 'branch' }]),
        onConflict: 'refuse',
      }),
    );
    expect(result.marks).toEqual([
      {
        path: 'a.txt',
        fingerprint: 'branch',
        reviewedAt: '2026-01-02T00:00:00.000Z',
      },
    ]);
    expect((await marked(store, 'a.txt'))?.fingerprint).toBe('worktree');
  });

  it('keeps every mark of a branch that changes more files than the worktree limit', async () => {
    const store = new InMemoryReviewedFileStore();
    const service = Effect.runSync(
      SetReviewedFilesService.pipe(
        Effect.provide(SetReviewedFilesService.layer),
        Effect.provideService(ReviewedFileStore, store),
        Effect.provideService(
          Clock.Clock,
          await testClock('2026-01-02T00:00:00.000Z'),
        ),
        Effect.provideService(SetReviewedFilesOptions, {
          marksPerWorktree: 2000,
          marksPerBranch: 10_000,
        }),
      ),
    );
    const branch = 'refs/heads/feature';
    const files = Array.from({ length: 2001 }, (_, index) => ({
      path: `file-${String(index).padStart(4, '0')}`,
      fingerprint: 'f',
    }));
    Effect.runSync(
      service.execute({
        worktreeId,
        scope: 'branch',
        branch,
        files: files.slice(0, 2000),
        changes: changes(files),
        onConflict: 'report',
      }),
    );
    Effect.runSync(
      service.execute({
        worktreeId,
        scope: 'branch',
        branch,
        files: files.slice(2000),
        changes: changes(files),
        onConflict: 'report',
      }),
    );
    expect(
      await Effect.runPromise(
        store.list({ worktreeId, scope: 'branch', branch }),
      ),
    ).toHaveLength(2001);
  });

  it('never evicts the mark of a file the branch still changes, only marks it no longer shows', async () => {
    const store = new InMemoryReviewedFileStore();
    const service = Effect.runSync(
      SetReviewedFilesService.pipe(
        Effect.provide(SetReviewedFilesService.layer),
        Effect.provideService(ReviewedFileStore, store),
        Effect.provideService(
          Clock.Clock,
          await testClock('2026-01-02T00:00:00.000Z'),
        ),
        Effect.provideService(SetReviewedFilesOptions, {
          marksPerWorktree: 2000,
          marksPerBranch: 2,
        }),
      ),
    );
    const branch = 'refs/heads/feature';
    await Effect.runPromise(
      store.save({
        worktreeId,
        scope: 'branch',
        branch,
        marks: [
          {
            path: 'gone',
            fingerprint: 'g',
            reviewedAt: '2025-06-01T00:00:00.000Z',
            stale: false,
          },
          {
            path: 'kept',
            fingerprint: 'k',
            reviewedAt: '2025-01-01T00:00:00.000Z',
            stale: false,
          },
        ],
      }),
    );
    Effect.runSync(
      service.execute({
        worktreeId,
        scope: 'branch',
        branch,
        files: [{ path: 'new', fingerprint: 'n' }],
        changes: changes([
          { path: 'kept', fingerprint: 'k' },
          { path: 'new', fingerprint: 'n' },
        ]),
        onConflict: 'report',
      }),
    );
    expect(
      (
        await Effect.runPromise(
          store.list({ worktreeId, scope: 'branch', branch }),
        )
      ).map((mark) => mark.path),
    ).toEqual(['kept', 'new']);
  });
});
