import { NodeServices } from '@effect/platform-node';
import {
  type ArchivePullRequestRequest,
  type ReadPullRequestResponse,
} from '@porcelain/contracts/projects';

import { listWorktrees } from '@porcelain/git/discovery';
import { InventoryStore } from '@porcelain/projects/ports';
import { CheckProjectService } from '@porcelain/projects/services';
import {
  BranchArchiver,
  WorktreeCatalogStore,
} from '@porcelain/projects/ports';
import {
  ArchiveBranchService,
  ListKnownWorktreesService,
} from '@porcelain/projects/services';
import { storageLayer } from '@porcelain/storage';
import {
  Cause,
  Context,
  Deferred,
  Effect,
  Exit,
  Fiber,
  Layer,
  type Scope,
} from 'effect';
import { execFile } from 'node:child_process';
import { channel } from 'node:diagnostics_channel';

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect } from 'vitest';
import { gitBranchArchiverLayer } from '../../src/adapters/projects/git-branch-archiver.ts';
import { LIMITS } from '../../src/config/limits.ts';
import { InventoryScan } from '../../src/ports/inventory-scan.ts';
import { EventPublisher } from '../../src/ports/event-publisher.ts';
import { LaneOptions } from '../../src/ports/lane-options.ts';
import { ReadProjectPullRequestUseCasePort } from '../../src/ports/read-project-pull-request-use-case-port.ts';
import { LaneKeys } from '../../src/runtime/lane-keys.ts';
import { Lanes } from '../../src/runtime/lanes.ts';
import { ArchivePullRequestUseCase } from '../../src/use-cases/projects/archive-pull-request.ts';
import { record, text } from '../kit/session.ts';
import { test } from '../kit/server-test.ts';

const execute = promisify(execFile);
const all = {
  deleteWorktree: true,
  deleteLocalBranch: true,
  deleteRemoteBranch: true,
};
const PR_URL = 'https://github.com/FabioFiorita/porcelain/pull/423';
const operations = channel('porcelain:operation');

type Fixture = {
  lanes: Lanes['Service'];
  archive: ArchivePullRequestUseCase['Service'];
  inventory: InventoryStore;
  input: ArchivePullRequestRequest & { projectId: string; number: number };
  head: string;
  P: string;
  worktree: string;
  remote: string;
  git: (...args: string[]) => Promise<string>;
  trace: string[];
  state: {
    hold: boolean;
    failCleanup: boolean;
    pull: ReadPullRequestResponse;
    readPull?: () => Effect.Effect<ReadPullRequestResponse>;
  };
  started: Deferred.Deferred<void>;
  release: Deferred.Deferred<void>;
  cleaning: Deferred.Deferred<void>;
  cleanup: Deferred.Deferred<void>;
  owners: string[];
};

async function withArchive<E>(
  run: (fixture: Fixture) => Effect.Effect<void, E, Scope.Scope>,
  main = false,
) {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-archive-lanes-'));
  const repository = join(root, 'repository');
  const worktree = join(root, 'feature');
  const remote = join(root, 'remote.git');
  const git = async (...args: string[]) =>
    (
      await execute('git', args, {
        cwd: repository,
        env: {
          ...process.env,
          HOME: root,
          GIT_CONFIG_GLOBAL: '/dev/null',
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_TERMINAL_PROMPT: '0',
          GIT_AUTHOR_NAME: 'Archive Test',
          GIT_AUTHOR_EMAIL: 'archive@example.invalid',
          GIT_COMMITTER_NAME: 'Archive Test',
          GIT_COMMITTER_EMAIL: 'archive@example.invalid',
        },
      })
    ).stdout.trim();
  try {
    await mkdir(repository);
    await git('init', '-b', 'main');
    await writeFile(join(repository, 'note.txt'), 'Retained code\n');
    await git('add', '.');
    await git('-c', 'commit.gpgsign=false', 'commit', '-m', 'Initial code');
    await git('init', '--bare', remote);
    await git('worktree', 'add', '-b', 'feature', worktree);
    await git('remote', 'add', 'origin', remote);
    await git('push', '-u', 'origin', 'feature');
    const head = await git('rev-parse', 'feature');
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const context = yield* Layer.build(
            storageLayer(join(root, 'state'), {
              worktreeIdLength: 32,
              busyTimeoutMs: 5000,
            }),
          );
          const inventory = Context.get(context, InventoryStore);
          const discovered = yield* listWorktrees(
            join(repository, '.git'),
            LIMITS.git,
          );
          const P = discovered.repositoryIdentity;
          const review = {
            projectId: 'archive-project',
            commonDirectory: join(repository, '.git'),
            worktreePath: main ? repository : worktree,
            branch: main ? 'main' : 'feature',
          };
          yield* inventory.save({
            id: review.projectId,
            name: 'Archive project',
            namedByOwner: false,
            commonDirectory: review.commonDirectory,
            repositoryIdentity: P,
            available: true,
            position: 0,
          });
          const lanes = Context.get(
            yield* Layer.build(Lanes.layer).pipe(
              Effect.provideService(LaneOptions, {
                deadlineMs: 10_000,
                readCapacity: 2,
                consistency: { execute: () => Effect.void },
              }),
            ),
            Lanes,
          );
          const native = Context.get(
            yield* Layer.build(gitBranchArchiverLayer(LIMITS.git)),
            BranchArchiver,
          );
          const started = yield* Deferred.make<void>();
          const release = yield* Deferred.make<void>();
          const cleaning = yield* Deferred.make<void>();
          const cleanup = yield* Deferred.make<void>();
          yield* Effect.addFinalizer(() =>
            Deferred.succeed(release, undefined).pipe(
              Effect.andThen(Deferred.succeed(cleanup, undefined)),
            ),
          );
          const state: Fixture['state'] = {
            hold: false,
            failCleanup: false,
            pull: {
              kind: 'available',
              account: 'fixture',
              pullRequest: {
                number: 423,
                title: 'Archive fixture',
                url: PR_URL,
                state: 'merged',
                draft: false,
                headBranch: main ? 'main' : 'feature',
                updatedAt: '2026-10-19T00:00:00Z',
                checksTruncated: false,
                description: '',
                baseBranch: 'main',
                headSha: head,
                headRepository: remote,
                mergeable: 'UNKNOWN',
                labels: [],
                checks: [],
                timeline: [],
                truncated: false,
              },
            },
          };
          const trace: string[] = [];
          let currentOperation: number | undefined;
          let runner = '';
          const owners: string[] = [];
          const protectedOperations = new Set<number>();
          const listener = (message: unknown) => {
            const event = record(message);
            if (typeof event.operation !== 'number') return;
            if (event.phase === 'started') {
              currentOperation = event.operation;
              runner = text(event.runner);
            }
            if (
              event.phase === 'settled' &&
              protectedOperations.delete(event.operation)
            )
              trace.push('settled');
          };
          yield* Effect.acquireRelease(
            Effect.sync(() => operations.subscribe(listener)),
            () => Effect.sync(() => operations.unsubscribe(listener)),
          );
          const archiver: BranchArchiver = {
            execute: (input) =>
              Effect.gen(function* () {
                if (currentOperation !== undefined)
                  protectedOperations.add(currentOperation);
                owners.push(runner);
                const plan = yield* native.execute(input);
                if (input.confirmation && state.hold) {
                  yield* Deferred.succeed(started, undefined);
                  yield* Deferred.await(release);
                }
                return plan;
              }).pipe(
                Effect.onExit((exit) =>
                  (state.hold && Exit.isFailure(exit)) ||
                  (state.failCleanup && Exit.isFailure(exit))
                    ? Deferred.succeed(cleaning, undefined).pipe(
                        Effect.andThen(Deferred.await(cleanup)),
                      )
                    : Effect.void,
                ),
              ),
          };
          const events: EventPublisher = {
            inventoryChanged: () =>
              Effect.sync(() => {
                trace.push('inventory');
              }),
            projectChanged: () => Effect.void,
            worktreeChanged: () => Effect.void,
            filesChanged: () => Effect.void,
            gitActionProgressed: () => Effect.void,
            gitActionChanged: () => Effect.void,
          };
          const services = Layer.mergeAll(
            ArchiveBranchService.layer,
            ListKnownWorktreesService.layer,
            CheckProjectService.layer,
          ).pipe(
            Layer.provide(
              Layer.mergeAll(
                Layer.succeed(WorktreeCatalogStore, {
                  find: () => undefined,
                  save: () => {},
                  listObservations: () => [],
                  lastSeen: () =>
                    discovered.worktrees.map(
                      ({ headCommittedAt, ...tree }, index) => ({
                        ...tree,
                        metadataIdentity:
                          tree.metadataIdentity ?? String(index),
                        id: String(index),
                        projectId: review.projectId,
                        repositoryId: P,
                        repositoryIdentity: P,
                        commonDirectory: review.commonDirectory,
                        branch: tree.branch ?? undefined,
                        ...(headCommittedAt ? { headCommittedAt } : {}),
                      }),
                    ),
                }),
                Layer.succeed(InventoryStore, inventory),
                Layer.succeed(BranchArchiver, archiver),
              ),
            ),
          );
          const archive = Context.get(
            yield* Layer.build(
              ArchivePullRequestUseCase.layer.pipe(
                Layer.provide(
                  Layer.mergeAll(
                    services,
                    Layer.succeed(InventoryScan, {
                      execute: () =>
                        Effect.sync(() => {
                          trace.push('inventory');
                        }),
                    }),
                    LaneKeys.layer,
                    Layer.succeed(Lanes, lanes),
                    Layer.succeed(EventPublisher, events),
                    Layer.succeed(ReadProjectPullRequestUseCasePort, {
                      execute: () =>
                        state.readPull?.() ?? Effect.succeed(state.pull),
                    }),
                  ),
                ),
              ),
            ),
            ArchivePullRequestUseCase,
          );
          yield* run({
            lanes,
            archive,
            inventory,
            input: { projectId: review.projectId, number: 423, options: all },
            head,
            P,
            worktree,
            remote,
            git,
            trace,
            state,
            started,
            release,
            cleaning,
            cleanup,
            owners,
          });
        }),
      ).pipe(Effect.provide(NodeServices.layer)),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

for (const state of ['closed', 'merged'] as const) {
  test(`real archive ${state}: preview retains Git, success publishes once after all settlement`, () =>
    withArchive((f) =>
      Effect.gen(function* () {
        if (f.state.pull.kind === 'available')
          f.state.pull = {
            ...f.state.pull,
            pullRequest: { ...f.state.pull.pullRequest, state },
          };
        const preview = yield* f.archive.execute(f.input);
        expect(preview).toMatchObject({
          archived: false,
          plan: {
            worktreePath: f.worktree,
            localBranch: 'feature',
            remoteBranch: 'origin/feature',
            mainCheckout: false,
            dirty: false,
            unpushed: false,
          },
        });
        expect(f.trace).toEqual(['settled']);
        expect(
          yield* Effect.promise(() =>
            f.git('rev-parse', '--verify', 'feature'),
          ),
        ).toMatch(/^[a-f0-9]{40}$/);
        f.trace.length = 0;
        const result = yield* f.archive.execute({
          ...f.input,
          confirmation: { plan: preview.plan, discardChanges: false },
        });
        expect(result.archived).toBe(true);
        expect(
          f.trace,
          'archive event must follow the complete protected operation settlement',
        ).toEqual(['settled', 'inventory']);
        expect(f.owners).toEqual([f.P, f.P]);

        expect(
          yield* Effect.promise(() => f.git('branch', '--list', 'feature')),
        ).toBe('');
        expect(
          yield* Effect.promise(() =>
            f.git('ls-remote', '--heads', 'origin', 'feature'),
          ),
        ).toBe('');
        expect(
          yield* Effect.promise(() => f.git('worktree', 'list', '--porcelain')),
        ).not.toContain(f.worktree);
      }),
    ));
}

test('archive without cleanup retains local commits when the push remote is unavailable', () =>
  withArchive((f) =>
    Effect.gen(function* () {
      yield* Effect.promise(async () => {
        await writeFile(join(f.worktree, 'note.txt'), 'Local commit\n');
        await f.git('-C', f.worktree, 'commit', '-am', 'Local only');
        await writeFile(join(f.worktree, 'unsaved.txt'), 'Unsaved work\n');
        await f.git(
          'remote',
          'set-url',
          '--push',
          'origin',
          `${f.remote}.unavailable`,
        );
      });
      const input = {
        ...f.input,
        options: {
          deleteWorktree: false,
          deleteLocalBranch: false,
          deleteRemoteBranch: false,
        },
      };
      const preview = yield* f.archive.execute(input);
      expect(preview).toMatchObject({
        archived: false,
        plan: {
          worktreePath: undefined,
          detachWorktreePath: undefined,
          localBranch: undefined,
          remoteBranch: undefined,
          dirty: false,
          unpushed: false,
        },
      });

      expect(
        (yield* f.archive.execute({
          ...input,
          confirmation: { plan: preview.plan, discardChanges: false },
        })).archived,
      ).toBe(true);

      expect(
        yield* Effect.promise(() =>
          readFile(join(f.worktree, 'unsaved.txt'), 'utf8'),
        ),
      ).toBe('Unsaved work\n');
      expect(
        yield* Effect.promise(() =>
          f.git('-C', f.worktree, 'branch', '--show-current'),
        ),
      ).toBe('feature');
      expect(
        yield* Effect.promise(() =>
          f.git('log', '-1', '--format=%s', 'feature'),
        ),
      ).toBe('Local only');
      expect(
        yield* Effect.promise(() =>
          f.git('--git-dir', f.remote, 'log', '-1', '--format=%s', 'feature'),
        ),
      ).toBe('Initial code');
      expect(f.trace).toEqual(['settled', 'settled', 'inventory']);
    }),
  ));

for (const owner of ['P'] as const) {
  test(`archive cancellation excludes the exact ${owner} owner through port cleanup`, () =>
    withArchive((f) =>
      Effect.gen(function* () {
        const preview = yield* f.archive.execute(f.input);
        f.state.hold = true;
        f.trace.length = 0;
        const caller = yield* Effect.forkChild(
          f.archive.execute({
            ...f.input,
            confirmation: { plan: preview.plan, discardChanges: false },
          }),
        );
        yield* Deferred.await(f.started);
        const entered: string[] = [];
        const follower = yield* Effect.forkChild(
          f.lanes.run(f[owner], 'write', () =>
            Effect.sync(() => {
              entered.push(owner);
            }),
          ),
          { startImmediately: true },
        );
        expect(
          yield* f.lanes.run('unrelated', 'write', () =>
            Effect.succeed('control admitted'),
          ),
        ).toBe('control admitted');
        expect(entered, `${owner} writer must queue during archive`).toEqual(
          [],
        );
        yield* Fiber.interrupt(caller);
        expect(Exit.isFailure(yield* Fiber.await(caller))).toBe(true);
        yield* Deferred.await(f.cleaning);
        yield* Effect.yieldNow;
        expect(
          entered,
          `${owner} writer must remain excluded until archive cleanup ends`,
        ).toEqual([]);
        expect(f.trace).not.toContain('inventory');
        yield* Deferred.succeed(f.cleanup, undefined);
        yield* Fiber.join(follower);
        expect(entered).toEqual([owner]);

        f.state.hold = false;
        const remaining = yield* f.archive.execute(f.input);
        expect(remaining).toMatchObject({ archived: false });
        expect(remaining.plan.worktreePath).toBeUndefined();
        expect(remaining.plan.localBranch).toBeUndefined();
        expect(
          (yield* f.archive.execute({
            ...f.input,
            confirmation: { plan: remaining.plan, discardChanges: false },
          })).archived,
        ).toBe(true);
      }),
    ));
}

test('real remote failure reports completed targets, holds the repository owner through cleanup, and recovers', () =>
  withArchive((f) =>
    Effect.gen(function* () {
      const hook = join(f.remote, 'hooks', 'pre-receive');
      yield* Effect.promise(() =>
        writeFile(hook, '#!/bin/sh\nexit 1\n', { mode: 0o755 }),
      );
      const preview = yield* f.archive.execute(f.input);
      f.state.failCleanup = true;
      f.trace.length = 0;
      const caller = yield* Effect.forkChild(
        Effect.exit(
          f.archive.execute({
            ...f.input,
            confirmation: { plan: preview.plan, discardChanges: false },
          }),
        ),
      );
      yield* Deferred.await(f.cleaning);
      const entered: string[] = [];
      const followers = [];
      for (const owner of ['P'] as const)
        followers.push(
          yield* Effect.forkChild(
            f.lanes.run(f[owner], 'write', () =>
              Effect.sync(() => {
                entered.push(owner);
              }),
            ),
            { startImmediately: true },
          ),
        );
      expect(entered).toEqual([]);
      expect(f.trace).toEqual([]);
      yield* Deferred.succeed(f.cleanup, undefined);
      const result = yield* Fiber.join(caller);
      expect(
        Exit.isFailure(result) && Cause.squash(result.cause),
      ).toMatchObject({
        _tag: 'BranchArchiveRefusedError',
        message: `Could not delete remote branch origin/feature. Deleted: worktree ${f.worktree}, local branch feature. Not deleted: remote branch origin/feature. Reopen the deletion confirmation to review the remaining targets.`,
      });
      yield* Fiber.joinAll(followers);
      expect(entered.toSorted()).toEqual(['P']);
      expect(f.trace).not.toContain('inventory');

      const remaining = yield* f.archive.execute(f.input);
      expect(remaining.plan).toMatchObject({ remoteBranch: 'origin/feature' });
      expect(remaining.plan.worktreePath).toBeUndefined();
      expect(remaining.plan.localBranch).toBeUndefined();
      yield* Effect.promise(() => rm(hook));
      expect(
        (yield* f.archive.execute({
          ...f.input,
          confirmation: { plan: remaining.plan, discardChanges: false },
        })).archived,
      ).toBe(true);
      expect(
        yield* Effect.promise(() =>
          f.git('ls-remote', '--heads', 'origin', 'feature'),
        ),
      ).toBe('');
    }),
  ));

for (const reason of [
  'gh-not-installed',
  'no-accounts',
  'no-access',
  'not-github',
  'rate-limited',
  'offline',
  'invalid-response',
] as const) {
  test(`archive refuses ${reason} before changing real Git`, () =>
    withArchive((f) =>
      Effect.gen(function* () {
        f.state.pull = { kind: 'unavailable', reason };
        const result = yield* Effect.exit(f.archive.execute(f.input));
        expect(
          Exit.isFailure(result) && Cause.squash(result.cause),
        ).toMatchObject({ _tag: 'BranchArchiveRefusedError' });
        expect(
          yield* Effect.promise(() => f.git('branch', '--list', 'feature')),
        ).toBe('+ feature');
        expect(f.trace).toEqual([]);
      }),
    ));
}
test.each([
  [false, false, false],
  [false, false, true],
  [false, true, false],
  [false, true, true],
  [true, false, false],
  [true, false, true],
  [true, true, false],
  [true, true, true],
])(
  'real cleanup selection worktree=%s local=%s remote=%s',
  (deleteWorktree, deleteLocalBranch, deleteRemoteBranch) =>
    withArchive((f) =>
      Effect.gen(function* () {
        const input = {
          ...f.input,
          options: {
            deleteWorktree,
            deleteLocalBranch,
            deleteRemoteBranch,
          },
        };
        const preview = yield* f.archive.execute(input);
        expect(preview.plan.worktreePath).toBe(
          deleteWorktree ? f.worktree : undefined,
        );
        expect(preview.plan.detachWorktreePath).toBe(
          !deleteWorktree && deleteLocalBranch ? f.worktree : undefined,
        );
        expect(preview.plan.localBranch).toBe(
          deleteLocalBranch ? 'feature' : undefined,
        );
        expect(preview.plan.remoteBranch).toBe(
          deleteRemoteBranch ? 'origin/feature' : undefined,
        );
        expect(
          (yield* f.archive.execute({
            ...input,
            confirmation: { plan: preview.plan, discardChanges: false },
          })).archived,
        ).toBe(true);
        expect(
          yield* Effect.promise(() => f.git('branch', '--list', 'feature')),
        ).toBe(
          deleteLocalBranch ? '' : deleteWorktree ? 'feature' : '+ feature',
        );
        expect(
          yield* Effect.promise(() =>
            f.git('ls-remote', '--heads', 'origin', 'feature'),
          ),
        ).toBe(deleteRemoteBranch ? '' : `${f.head}\trefs/heads/feature`);
        expect(
          (yield* Effect.promise(() =>
            f.git('worktree', 'list', '--porcelain'),
          )).includes(f.worktree),
        ).toBe(!deleteWorktree);
      }),
    ),
);

test.each([
  [false, false, false],
  [false, false, true],
  [false, true, false],
  [false, true, true],
  [true, false, false],
  [true, false, true],
  [true, true, false],
  [true, true, true],
])(
  'protected main with selection %s/%s/%s',
  (deleteWorktree, deleteLocalBranch, deleteRemoteBranch) =>
    withArchive(
      (f) =>
        Effect.gen(function* () {
          const input = {
            ...f.input,
            options: {
              deleteWorktree,
              deleteLocalBranch,
              deleteRemoteBranch,
            },
          };
          const preview = yield* f.archive.execute(input);
          expect(preview.plan).toMatchObject({
            mainCheckout: true,
            dirty: false,
            unpushed: false,
          });
          expect(
            Object.keys(preview.plan)
              .filter((key) => Reflect.get(preview.plan, key) !== undefined)
              .toSorted(),
          ).toEqual(['dirty', 'fingerprint', 'mainCheckout', 'unpushed']);
          expect(
            (yield* f.archive.execute({
              ...input,
              confirmation: { plan: preview.plan, discardChanges: false },
            })).archived,
          ).toBe(true);
          expect(
            yield* Effect.promise(() => f.git('symbolic-ref', 'HEAD')),
          ).toBe('refs/heads/main');
          expect(
            yield* Effect.promise(() => f.git('branch', '--list', 'main')),
          ).toBe('* main');
        }),
      true,
    ),
);

test.each(['dirty', 'unpushed', 'both'] as const)(
  'archive %s requires explicit consent on the current plan',
  (state) =>
    withArchive((f) =>
      Effect.gen(function* () {
        if (state !== 'dirty') {
          yield* Effect.promise(() =>
            writeFile(join(f.worktree, 'new.txt'), 'Unpushed code\n'),
          );
          yield* Effect.promise(() => f.git('-C', f.worktree, 'add', '.'));
          yield* Effect.promise(() =>
            f.git(
              '-C',
              f.worktree,
              '-c',
              'commit.gpgsign=false',
              'commit',
              '-m',
              'Unpushed change',
            ),
          );
        }
        if (state !== 'unpushed')
          yield* Effect.promise(() =>
            writeFile(join(f.worktree, 'dirty.txt'), 'Unsaved code\n'),
          );
        const preview = yield* f.archive.execute(f.input);
        expect({
          dirty: preview.plan.dirty,
          unpushed: preview.plan.unpushed,
        }).toEqual({
          dirty: state !== 'unpushed',
          unpushed: state !== 'dirty',
        });
        const refused = yield* Effect.exit(
          f.archive.execute({
            ...f.input,
            confirmation: { plan: preview.plan, discardChanges: false },
          }),
        );
        expect(
          Exit.isFailure(refused) && Cause.squash(refused.cause),
        ).toMatchObject({
          message:
            'Explicitly confirm the uncommitted changes and unpushed commits before deleting.',
        });
        expect(f.trace).not.toContain('inventory');
        expect(
          (yield* f.archive.execute({
            ...f.input,
            confirmation: { plan: preview.plan, discardChanges: true },
          })).archived,
        ).toBe(true);
      }),
    ),
);

test('stale bytes with the same dirty status refuse deletion, then a new preview recovers', () =>
  withArchive((f) =>
    Effect.gen(function* () {
      const path = join(f.worktree, 'dirty.txt');
      yield* Effect.promise(() => writeFile(path, 'First bytes\n'));
      const preview = yield* f.archive.execute(f.input);
      const status = yield* Effect.promise(() =>
        f.git('-C', f.worktree, 'status', '--porcelain'),
      );
      yield* Effect.promise(() => writeFile(path, 'New bytes\n'));
      expect(
        yield* Effect.promise(() =>
          f.git('-C', f.worktree, 'status', '--porcelain'),
        ),
      ).toBe(status);
      const refused = yield* Effect.exit(
        f.archive.execute({
          ...f.input,
          confirmation: { plan: preview.plan, discardChanges: true },
        }),
      );
      expect(
        Exit.isFailure(refused) && Cause.squash(refused.cause),
      ).toMatchObject({
        message:
          'The worktree, branches or settings changed. Reopen the deletion confirmation and confirm the new deletion plan.',
      });
      expect(yield* Effect.promise(() => readFile(path, 'utf8'))).toBe(
        'New bytes\n',
      );
      expect(f.trace).not.toContain('inventory');
      const current = yield* f.archive.execute(f.input);
      expect(
        (yield* f.archive.execute({
          ...f.input,
          confirmation: { plan: current.plan, discardChanges: true },
        })).archived,
      ).toBe(true);
    }),
  ));

for (const state of ['merged', 'closed'] as const) {
  test(`archive refuses a ${state} fork PR with the same local branch name without deleting anything`, () =>
    withArchive((f) =>
      Effect.gen(function* () {
        if (f.state.pull.kind !== 'available')
          throw new Error('Expected a pull request');
        f.state.pull = {
          ...f.state.pull,
          pullRequest: {
            ...f.state.pull.pullRequest,
            state,
            headRepository: 'https://github.com/someone/porcelain',
          },
        };
        const result = yield* Effect.result(f.archive.execute(f.input));
        expect(result).toMatchObject({
          _tag: 'Failure',
          failure: {
            _tag: 'BranchArchiveRefusedError',
          },
        });
        expect(yield* Effect.promise(() => f.git('rev-parse', 'feature'))).toBe(
          f.head,
        );
        expect(
          yield* Effect.promise(() =>
            f.git('ls-remote', '--heads', 'origin', 'feature'),
          ),
        ).toBe(`${f.head}\trefs/heads/feature`);
        expect(
          yield* Effect.promise(() =>
            readFile(join(f.worktree, 'note.txt'), 'utf8'),
          ),
        ).toBe('Retained code\n');
        expect(f.trace).not.toContain('inventory');
      }),
    ));
}

test('archive refuses a fully pushed reused branch whose head is unrelated to the PR', () =>
  withArchive((f) =>
    Effect.gen(function* () {
      const unrelated = yield* Effect.promise(async () => {
        const tree = await f.git('rev-parse', `${f.head}^{tree}`);
        const head = await f.git('commit-tree', tree, '-m', 'Unrelated branch');
        await f.git('update-ref', 'refs/heads/feature', head);
        await f.git('push', '--force', 'origin', 'feature');
        return head;
      });
      const result = yield* Effect.result(f.archive.execute(f.input));
      expect(result).toMatchObject({
        _tag: 'Failure',
        failure: {
          _tag: 'BranchArchiveRefusedError',
        },
      });
      expect(yield* Effect.promise(() => f.git('rev-parse', 'feature'))).toBe(
        unrelated,
      );
      expect(
        yield* Effect.promise(() =>
          f.git('ls-remote', '--heads', 'origin', 'feature'),
        ),
      ).toBe(`${unrelated}\trefs/heads/feature`);
      expect(
        yield* Effect.promise(() =>
          readFile(join(f.worktree, 'note.txt'), 'utf8'),
        ),
      ).toBe('Retained code\n');
    }),
  ));

for (const mismatch of [
  'missing-repository',
  'upstream-ref',
  'push-repository',
  'remote-head',
] as const) {
  test(`archive refuses an unproven ${mismatch} association before producing any deletion target`, () =>
    withArchive((f) =>
      Effect.gen(function* () {
        if (mismatch === 'missing-repository') {
          if (f.state.pull.kind !== 'available')
            throw new Error('Expected a pull request');
          const { headRepository: _repository, ...pullRequest } =
            f.state.pull.pullRequest;
          f.state.pull = { ...f.state.pull, pullRequest };
        } else {
          yield* Effect.promise(async () => {
            if (mismatch === 'upstream-ref')
              await f.git(
                'config',
                'branch.feature.merge',
                'refs/heads/unrelated',
              );
            if (mismatch === 'push-repository')
              await f.git(
                'remote',
                'set-url',
                '--push',
                'origin',
                `${f.remote}.unrelated`,
              );
            if (mismatch === 'remote-head') {
              const tree = await f.git('rev-parse', `${f.head}^{tree}`);
              const unrelated = await f.git(
                'commit-tree',
                tree,
                '-m',
                'Reused remote branch',
              );
              await f.git(
                'push',
                '--force',
                'origin',
                `${unrelated}:refs/heads/feature`,
              );
            }
          });
        }
        const result = yield* Effect.result(
          f.archive.execute({
            ...f.input,
            options: {
              deleteWorktree: true,
              deleteLocalBranch: true,
              deleteRemoteBranch: false,
            },
          }),
        );
        expect(result._tag).toBe('Failure');
        if (result._tag === 'Failure')
          expect(result.failure.message).toContain('Nothing was deleted');
        expect(yield* Effect.promise(() => f.git('rev-parse', 'feature'))).toBe(
          f.head,
        );
        expect(
          yield* Effect.promise(() =>
            f.git(
              '--git-dir',
              f.remote,
              'show-ref',
              '--verify',
              'refs/heads/feature',
            ),
          ),
        ).toContain('refs/heads/feature');
        expect(
          yield* Effect.promise(() =>
            readFile(join(f.worktree, 'note.txt'), 'utf8'),
          ),
        ).toBe('Retained code\n');
      }),
    ));
}

test('archive retains the merged head proof after GitHub deletes the remote branch', () =>
  withArchive((f) =>
    Effect.gen(function* () {
      yield* Effect.promise(() =>
        f.git('push', 'origin', '--delete', 'feature'),
      );
      const preview = yield* f.archive.execute(f.input);
      expect(preview.plan.unpushed).toBe(false);
      expect(preview.plan.remoteBranch).toBeUndefined();
      expect(
        (yield* f.archive.execute({
          ...f.input,
          confirmation: { plan: preview.plan, discardChanges: false },
        })).archived,
      ).toBe(true);
      expect(
        yield* Effect.promise(() => f.git('branch', '--list', 'feature')),
      ).toBe('');
    }),
  ));

test('archive refuses a response for another PR before selecting the branch', () =>
  withArchive((f) =>
    Effect.gen(function* () {
      const result = yield* Effect.result(
        f.archive.execute({ ...f.input, number: 424 }),
      );
      expect(result._tag).toBe('Failure');
      expect(yield* Effect.promise(() => f.git('rev-parse', 'feature'))).toBe(
        f.head,
      );
      expect(f.owners).toEqual([]);
    }),
  ));
