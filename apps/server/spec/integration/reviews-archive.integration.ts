import { SqlClient } from 'effect/sql';
import { NodeServices } from '@effect/platform-node';
import {
  type ArchiveReviewRequest,
  type ReadPullRequestResponse,
} from '@porcelain/contracts/reviews';
import { archiveReviewRequestSchema } from '@porcelain/reviews/models';
import { listWorktrees } from '@porcelain/git/discovery';
import { InventoryStore } from '@porcelain/projects/ports';
import { CheckProjectService } from '@porcelain/projects/services';
import { ReviewArchiver, ReviewStore } from '@porcelain/reviews/ports';
import {
  ArchiveReviewService,
  ReadReviewRecordService,
} from '@porcelain/reviews/services';
import { reviewFixture, reviewSave } from '@porcelain/reviews/store-contracts';
import { storageLayer } from '@porcelain/storage';
import {
  Cause,
  Context,
  Deferred,
  Effect,
  Exit,
  Fiber,
  Layer,
  Schema,
  type Scope,
} from 'effect';
import { execFile } from 'node:child_process';
import { channel } from 'node:diagnostics_channel';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect } from 'vitest';
import { gitReviewArchiverLayer } from '../../src/adapters/reviews/git-review-archiver.ts';
import { LIMITS } from '../../src/config/limits.ts';
import { EventPublisher } from '../../src/ports/event-publisher.ts';
import { LaneOptions } from '../../src/ports/lane-options.ts';
import { ReadReviewPullRequestUseCasePort } from '../../src/ports/read-review-pull-request-use-case-port.ts';
import { LaneKeys } from '../../src/runtime/lane-keys.ts';
import { Lanes } from '../../src/runtime/lanes.ts';
import { ArchiveReviewUseCase } from '../../src/use-cases/reviews/archive-review.ts';
import {
  commitReviewFixture,
  read,
  sampleReview,
  toolCall,
  toolValue,
} from '../kit/requests.ts';
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
  archive: ArchiveReviewUseCase['Service'];
  store: ReviewStore;
  inventory: InventoryStore;
  input: ArchiveReviewRequest & { reviewId: string };
  P: string;
  R: string;
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
  removeRevision: () => Effect.Effect<void>;
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
          const store = Context.get(context, ReviewStore);
          const sql = Context.get(context, SqlClient.SqlClient);
          const inventory = Context.get(context, InventoryStore);
          const discovered = yield* listWorktrees(
            join(repository, '.git'),
            LIMITS.git,
          );
          const P = discovered.repositoryIdentity;
          const review = reviewFixture({
            projectId: 'archive-project',
            commonDirectory: join(repository, '.git'),
            worktreePath: main ? repository : worktree,
            branch: main ? 'main' : 'feature',
            headOid: head,
            baseOid: head,
            mergeBaseOid: head,
          });
          const R = `review:${review.reviewId}`;
          yield* inventory.save({
            id: review.projectId,
            name: 'Archive project',
            namedByOwner: false,
            commonDirectory: review.commonDirectory,
            repositoryIdentity: P,
            available: true,
            position: 0,
          });
          yield* store.save(
            reviewSave(review, { state: 'closed', pullRequest: PR_URL }),
          );
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
            yield* Layer.build(gitReviewArchiverLayer(LIMITS.git)),
            ReviewArchiver,
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
                headBranch: 'feature',
                updatedAt: '2026-10-19T00:00:00Z',
                checksTruncated: false,
                description: '',
                baseBranch: 'main',
                headSha: head,
                matchesReviewHead: true,
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
          const archiver: ReviewArchiver = {
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
            ArchiveReviewService.layer,
            ReadReviewRecordService.layer,
            CheckProjectService.layer,
          ).pipe(
            Layer.provide(
              Layer.mergeAll(
                Layer.succeed(ReviewStore, store),
                Layer.succeed(InventoryStore, inventory),
                Layer.succeed(ReviewArchiver, archiver),
              ),
            ),
          );
          const archive = Context.get(
            yield* Layer.build(
              ArchiveReviewUseCase.layer.pipe(
                Layer.provide(
                  Layer.mergeAll(
                    services,
                    LaneKeys.layer,
                    Layer.succeed(Lanes, lanes),
                    Layer.succeed(EventPublisher, events),
                    Layer.succeed(ReadReviewPullRequestUseCasePort, {
                      execute: () =>
                        state.readPull?.() ?? Effect.succeed(state.pull),
                    }),
                  ),
                ),
              ),
            ),
            ArchiveReviewUseCase,
          );
          yield* run({
            lanes,
            archive,
            store,
            inventory,
            input: { reviewId: review.reviewId, options: all },
            P,
            R,
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
            removeRevision: () =>
              sql`DELETE FROM review_revisions WHERE review_id = ${review.reviewId}`.pipe(
                Effect.orDie,
                Effect.asVoid,
              ),
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
        expect(f.owners).toEqual([
          JSON.stringify([f.P, f.R]),
          JSON.stringify([f.P, f.R]),
        ]);
        expect(yield* f.store.readRecord(f.input)).toMatchObject({
          archived: true,
          state: 'closed',
          latestRevision: 1,
        });
        expect(yield* f.store.read(f.input)).toMatchObject({
          summaryHtml: '<p>Review</p>',
          revision: 1,
        });
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

test('archive without cleanup retains persisted review and local commits when the push remote is unavailable', () =>
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
      expect(yield* f.store.readRecord(input)).toMatchObject({
        archived: false,
      });
      expect(
        (yield* f.archive.execute({
          ...input,
          confirmation: { plan: preview.plan, discardChanges: false },
        })).archived,
      ).toBe(true);
      expect(yield* f.store.readRecord(input)).toMatchObject({
        archived: true,
      });
      expect(yield* f.store.read(input)).toMatchObject({
        revision: 1,
        summaryHtml: '<p>Review</p>',
      });
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

for (const owner of ['P', 'R'] as const) {
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
        expect(yield* f.store.readRecord(f.input)).not.toHaveProperty(
          'archived',
          true,
        );
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

test('two concurrent confirmations archive once and the follower refuses the archived record', () =>
  withArchive((f) =>
    Effect.gen(function* () {
      const preview = yield* f.archive.execute(f.input);
      const input = {
        ...f.input,
        confirmation: { plan: preview.plan, discardChanges: false },
      };
      f.state.hold = true;
      f.trace.length = 0;
      const first = yield* Effect.forkChild(f.archive.execute(input));
      yield* Deferred.await(f.started);
      let finished = false;
      const second = yield* Effect.forkChild(
        Effect.exit(f.archive.execute(input)).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              finished = true;
            }),
          ),
        ),
        { startImmediately: true },
      );
      expect(finished).toBe(false);
      yield* Deferred.succeed(f.release, undefined);
      expect((yield* Fiber.join(first)).archived).toBe(true);
      const result = yield* Fiber.join(second);
      expect(
        Exit.isFailure(result) && Cause.squash(result.cause),
      ).toMatchObject({
        _tag: 'ReviewArchiveRefusedError',
        message: 'This review is already archived.',
      });
      expect(f.trace.filter((event) => event === 'inventory')).toEqual([
        'inventory',
      ]);
      expect(yield* f.store.readRecord(f.input)).toMatchObject({
        archived: true,
      });
    }),
  ));

test('real remote failure reports completed targets, holds both owners through cleanup, and recovers', () =>
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
      for (const owner of ['P', 'R'] as const)
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
        _tag: 'ReviewArchiveRefusedError',
        message: `Could not delete remote branch origin/feature. Deleted: worktree ${f.worktree}, local branch feature. Not deleted: remote branch origin/feature. Reopen Archive to review the remaining targets.`,
      });
      yield* Fiber.joinAll(followers);
      expect(entered.toSorted()).toEqual(['P', 'R']);
      expect(f.trace).not.toContain('inventory');
      expect(yield* f.store.readRecord(f.input)).not.toHaveProperty(
        'archived',
        true,
      );
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

for (const variant of [
  'open',
  'not-linked',
  'gh-not-installed',
  'no-accounts',
  'no-access',
  'not-github',
  'rate-limited',
  'offline',
  'invalid-response',
  'archived',
  'missing-review',
  'missing-revision',
  'missing-project',
] as const) {
  test(`archive refuses ${variant} with real persisted inputs`, () =>
    withArchive((f) =>
      Effect.gen(function* () {
        if (variant === 'open' && f.state.pull.kind === 'available')
          f.state.pull = {
            ...f.state.pull,
            pullRequest: { ...f.state.pull.pullRequest, state: 'open' },
          };
        else if (variant === 'not-linked')
          f.state.pull = { kind: 'not-linked' };
        else if (variant === 'archived') yield* f.store.archive(f.input);
        else if (variant === 'missing-review') yield* f.store.remove(f.input);
        else if (variant === 'missing-revision') yield* f.removeRevision();
        else if (variant === 'missing-project')
          yield* f.inventory.remove({ projectId: 'archive-project' });
        else if (variant !== 'open')
          f.state.pull = { kind: 'unavailable', reason: variant };
        const result = yield* Effect.exit(f.archive.execute(f.input));
        expect(
          Exit.isFailure(result) && Cause.squash(result.cause),
        ).toMatchObject(
          variant === 'missing-review' || variant === 'missing-revision'
            ? { _tag: 'ReviewNotFoundError' }
            : variant === 'missing-project'
              ? { _tag: 'ProjectNotFoundError' }
              : {
                  _tag: 'ReviewArchiveRefusedError',
                  message:
                    variant === 'archived'
                      ? 'This review is already archived.'
                      : 'Only reviews with a merged or closed pull request can be archived. Refresh the pull request and retry.',
                },
        );
        expect(f.trace).not.toContain('inventory');
        expect(
          yield* Effect.promise(() => f.git('branch', '--list', 'feature')),
        ).toBe('+ feature');
      }),
    ));
}

test('HTTP archive preview, invalid flags, protected main and retained saved review use one ordinary server', async ({
  session,
  server,
}) => {
  const manifest = record(
    JSON.parse(await readFile(server.manifestPath, 'utf8')),
  );
  const gh = join(text(manifest.bin), 'gh');
  await writeFile(
    gh,
    `#!${process.execPath}
const args = process.argv.slice(2);
if (args[0] === 'auth') console.log(args[1] === 'status' ? '["fixture"]' : 'fixture-token');
else if (args.includes('repos/FabioFiorita/porcelain')) console.log('{}');
else {
 const pr = {number:423,title:'Fixture',url:${JSON.stringify(PR_URL)},state:'MERGED',isDraft:false,author:null,headRefName:'feature',updatedAt:'2026-10-19T00:00:00Z',commits:{nodes:[]},body:'',baseRefName:'main',headRefOid:'${'a'.repeat(40)}',mergeable:'UNKNOWN',labels:{nodes:[],pageInfo:{hasNextPage:false}},comments:{nodes:[],pageInfo:{hasNextPage:false}},reviews:{nodes:[],pageInfo:{hasNextPage:false}}};
 console.log(JSON.stringify({data:{repository:{pullRequest:pr}}}));
}
`,
    { mode: 0o755 },
  );
  try {
    await session.git('branch', 'porcelain-fixture-base');
    await session.git(
      'remote',
      'add',
      'origin',
      'git@github.com:FabioFiorita/porcelain.git',
    );
    await commitReviewFixture(session);
    const published = record(
      toolValue(
        await read(
          session,
          toolCall(session, 1, 'publish_review', {
            ...sampleReview(session, 0, randomUUID(), randomUUID()),
            pullRequest: PR_URL,
          }),
        ),
      ),
    );
    const path = `/api/reviews/${text(published.reviewId)}`;
    expect(
      record(
        await read(session, { method: 'GET', path: `${path}/pull-request` }),
      ),
    ).toMatchObject({ kind: 'available', pullRequest: { state: 'merged' } });
    for (const body of [
      { options: all, confirmation: false },
      { options: all, confirmation: null },
      { options: { ...all, deleteWorktree: null } },
      { options: { ...all, deleteRemoteBranch: 'false' } },
      { options: {} },
      {},
    ]) {
      expect(Schema.is(archiveReviewRequestSchema)(body)).toBe(false);
      await read(
        session,
        { method: 'POST', path: `${path}/archive`, body },
        400,
      );
    }
    const preview = record(
      await read(session, {
        method: 'POST',
        path: `${path}/archive`,
        body: { options: all },
      }),
    );
    expect(preview).toMatchObject({
      archived: false,
      plan: { mainCheckout: true, dirty: false, unpushed: false },
    });
    expect(Object.keys(record(preview.plan)).toSorted()).toEqual([
      'dirty',
      'fingerprint',
      'mainCheckout',
      'unpushed',
    ]);
    expect(
      await read(session, {
        method: 'POST',
        path: `${path}/archive`,
        body: {
          options: all,
          confirmation: { plan: preview.plan, discardChanges: false },
        },
      }),
    ).toMatchObject({ archived: true });
    expect(await read(session, { method: 'GET', path })).toMatchObject({
      review: { archived: true, state: 'closed' },
      revision: { revision: 1 },
    });
  } finally {
    await rm(gh, { force: true });
  }
});

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
        ).toBe(
          deleteRemoteBranch
            ? ''
            : `${(yield* f.store.read(f.input))?.headOid}\trefs/heads/feature`,
        );
        expect(
          (yield* Effect.promise(() =>
            f.git('worktree', 'list', '--porcelain'),
          )).includes(f.worktree),
        ).toBe(!deleteWorktree);
        expect(yield* f.store.readRecord(f.input)).toMatchObject({
          archived: true,
        });
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
            'Explicitly confirm the uncommitted changes and unpushed commits before archiving.',
        });
        expect(f.trace).not.toContain('inventory');
        expect(
          (yield* f.archive.execute({
            ...f.input,
            confirmation: { plan: preview.plan, discardChanges: true },
          })).archived,
        ).toBe(true);
        expect(yield* f.store.readRecord(f.input)).toMatchObject({
          archived: true,
        });
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
          'The worktree, branches or settings changed. Reopen Archive and confirm the new deletion plan.',
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

test('relinking after GitHub is read refuses archive before deleting real Git state', () =>
  withArchive((f) =>
    Effect.gen(function* () {
      const preview = yield* f.archive.execute(f.input);
      const stale = f.state.pull;
      f.state.readPull = () =>
        f.store
          .setPullRequest({
            reviewId: f.input.reviewId,
            pullRequest: 'https://github.com/FabioFiorita/porcelain/pull/424',
          })
          .pipe(Effect.orDie, Effect.as(stale));
      const result = yield* f.archive
        .execute({
          ...f.input,
          confirmation: { plan: preview.plan, discardChanges: false },
        })
        .pipe(Effect.result);
      expect(result).toMatchObject({
        _tag: 'Failure',
        failure: { _tag: 'ReviewArchiveRefusedError' },
      });
      expect(yield* f.store.readRecord(f.input)).toMatchObject({
        archived: false,
        pullRequest: 'https://github.com/FabioFiorita/porcelain/pull/424',
      });
      expect(
        yield* Effect.promise(() => f.git('branch', '--list', 'feature')),
      ).toContain('feature');
      expect(
        yield* Effect.promise(() => f.git('worktree', 'list', '--porcelain')),
      ).toContain(f.worktree);
      expect(
        yield* Effect.promise(() =>
          f.git('ls-remote', '--heads', 'origin', 'feature'),
        ),
      ).toContain('refs/heads/feature');
      expect(f.trace).not.toContain('inventory');
    }),
  ));
