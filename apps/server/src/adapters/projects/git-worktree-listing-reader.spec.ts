import {
  Duration,
  Cause,
  Deferred,
  Effect,
  Exit,
  Fiber,
  Semaphore,
} from 'effect';
import { withSignal } from '@porcelain/effects';
import { describe, expect, it } from '@effect/vitest';
import { TestClock } from 'effect/testing';
import { GitWorktreeListingReader } from './git-worktree-listing-reader.ts';

const project = {
  id: 'project-1',
  commonDirectory: '/srv/api/.git',
  repositoryIdentity: 'repository-1',
};

function reader(failure: unknown) {
  const reports: { kind: string; projectId?: string; error: unknown }[] = [];
  const listing = new GitWorktreeListingReader({
    git: () => ({
      listWorktrees: () => Promise.reject(failure),
      readOriginUrl: async () => null,
    }),
    sharedReads: {
      run: (_key, work) => work(),
    },
    launches: Effect.runSync(Semaphore.make(1)),
    timeout: Duration.seconds(5),
    worktreeId: (projectId, metadataIdentity) =>
      `${projectId}:${metadataIdentity}`,
    logger: { failure: (report) => reports.push(report) },
  });
  return { listing, reports };
}

describe('GitWorktreeListingReader', () => {
  it('reports a project whose listing fails unexpectedly as unavailable and logs why', async () => {
    const failure = new Error('git output could not be parsed');
    const { listing, reports } = reader(failure);
    expect(await Effect.runPromise(listing.list(project))).toEqual({
      kind: 'unavailable',
      projectId: project.id,
    });
    expect(reports).toEqual([
      { kind: 'worktree-listing', projectId: project.id, error: failure },
    ]);
  });

  it('reports a repository that is gone as unavailable without logging it', async () => {
    const { listing, reports } = reader(
      Object.assign(new Error('no such folder'), { code: 'ENOENT' }),
    );
    expect(await Effect.runPromise(listing.list(project))).toEqual({
      kind: 'unavailable',
      projectId: project.id,
    });
    expect(reports).toEqual([]);
  });

  it('stops instead of reporting the project when its caller cancels', async () => {
    const cancelled = AbortSignal.abort(new Error('cancelled'));
    const { listing, reports } = reader(new Error('interrupted'));
    const exit = await Effect.runPromiseExit(
      withSignal(listing.list(project), cancelled),
    );
    expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(
      true,
    );
    expect(reports).toEqual([]);
  });
  it.effect(
    'does not launch a cancelled listing that is waiting for a launch permit',
    () =>
      Effect.gen(function* () {
        const launches = yield* Semaphore.make(1);
        const occupied = yield* Deferred.make<void>();
        const released = yield* Deferred.make<void>();
        const queued = yield* Deferred.make<void>();
        let calls = 0;
        const holding = yield* Effect.forkChild(
          launches.withPermit(
            Deferred.succeed(occupied, undefined).pipe(
              Effect.andThen(Deferred.await(released)),
            ),
          ),
        );
        yield* Deferred.await(occupied);
        const listing = new GitWorktreeListingReader({
          git: () => ({
            listWorktrees: async () => {
              calls += 1;
              return {
                repository: {
                  commonDirectory: project.commonDirectory,
                  repositoryIdentity: 'repository-1',
                  worktrees: [],
                },
                issues: [],
              };
            },
            readOriginUrl: async () => null,
          }),
          sharedReads: {
            run: (_key, work) =>
              Deferred.succeed(queued, undefined).pipe(
                Effect.andThen(Effect.suspend(work)),
              ),
          },
          launches,
          timeout: Duration.seconds(5),
          worktreeId: (projectId, metadataIdentity) =>
            `${projectId}:${metadataIdentity}`,
          logger: { failure: () => undefined },
        });
        const cancelled = yield* Effect.forkChild(listing.list(project));
        yield* Deferred.await(queued);
        yield* Fiber.interrupt(cancelled);
        yield* Deferred.succeed(released, undefined);
        yield* Fiber.join(holding);
        expect(calls).toBe(0);
        expect(yield* listing.list(project)).toEqual({
          kind: 'listed',
          projectId: 'project-1',
          repositoryIdentity: 'repository-1',
          worktrees: [],
          unidentified: 0,
        });
        expect(calls).toBe(1);
      }),
  );

  it.effect(
    'aborts an expired listing and reports it as unavailable after native cleanup',
    () =>
      Effect.gen(function* () {
        const started = Promise.withResolvers<void>();
        const release = Promise.withResolvers<{
          repository: {
            commonDirectory: string;
            repositoryIdentity: string;
            worktrees: [];
          };
          issues: [];
        }>();
        const failures: unknown[] = [];
        let aborted = false;
        const listing = new GitWorktreeListingReader({
          git: () => ({
            listWorktrees: (signal) => {
              signal?.addEventListener(
                'abort',
                () => {
                  aborted = true;
                  release.reject(signal.reason);
                },
                { once: true },
              );
              started.resolve();
              return release.promise;
            },
            readOriginUrl: async () => null,
          }),
          sharedReads: { run: (_key, work) => work() },
          launches: yield* Semaphore.make(1),
          timeout: Duration.seconds(5),
          worktreeId: (projectId, metadataIdentity) =>
            `${projectId}:${metadataIdentity}`,
          logger: { failure: (report) => failures.push(report.error) },
        });
        const request = yield* Effect.forkChild(listing.list(project));
        yield* Effect.promise(() => started.promise);
        yield* TestClock.adjust(5000);
        expect(yield* Fiber.join(request)).toEqual({
          kind: 'unavailable',
          projectId: 'project-1',
        });
        expect(aborted).toBe(true);
        expect(failures).toHaveLength(1);
        expect(failures[0]).toBeInstanceOf(DOMException);
        expect(failures[0]).toMatchObject({ name: 'TimeoutError' });
      }),
  );
});
