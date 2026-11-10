import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Deferred, Effect, Layer, ManagedRuntime } from 'effect';
import { NodeServices } from '@effect/platform-node';
import { expect, it } from 'vitest';
import { storageLayer } from '@porcelain/storage';
import {
  PullRequestCommenter,
  WalkthroughStore,
} from '@porcelain/walkthroughs/ports';
import {
  AddWalkthroughMessageService,
  ListWalkthroughConversationsService,
  PlanWalkthroughPostService,
  PostWalkthroughMessagesService,
} from '@porcelain/walkthroughs/services';
import { IdSource } from '@porcelain/kernel/ports';
import type { ListedWorktree } from '@porcelain/projects/models';
import type { WalkthroughJob } from '@porcelain/walkthroughs/models';
import { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { LaneOptions } from '../../ports/lane-options.ts';
import { ResolveProjectGitHubUseCasePort } from '../../ports/resolve-project-github-use-case-port.ts';
import { WorktreeConsistencyProbe } from '../../ports/worktree-consistency-probe.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { PostWalkthroughMessagesUseCase } from './post-walkthrough-messages.ts';

const worktree: ListedWorktree = {
  id: 'tree',
  projectId: 'project',
  repositoryId: 'repository',
  path: '/repo',
  branch: 'refs/heads/main',
  main: true,
  available: true,
  metadataIdentity: 'metadata',
  administrativeDirectory: '/repo/.git',
  commonDirectory: '/repo/.git',
  repositoryIdentity: 'identity',
};
const job = (
  pullRequestNumber: number | undefined,
  pullRequestRepository: { owner: string; repo: string } | undefined,
  id = 'run',
): WalkthroughJob => ({
  run: {
    id,
    projectId: 'project',
    worktreeId: 'tree',
    pullRequestNumber,
    pullRequestRepository,
    baseOid: 'a'.repeat(40),
    headOid: id === 'run' ? 'b'.repeat(40) : 'c'.repeat(40),
    writer: { provider: 'claude', model: 'claude-opus-5-5', effort: 'high' },
    sessionId: 'session',
    createdAt: '2026-11-09T00:00:00.000Z',
    state: {
      status: 'ready',
      writtenAt: '2026-11-09T00:00:00.000Z',
      durationMs: 1,
      content: {
        outcome: 'worth_knowing',
        title: 'Walkthrough',
        summary: 'Summary.',
        growth: [],
        stops: [
          {
            title: 'Keep the retry local',
            explanation: 'Why.',
            excerpts: [
              { path: 'src/a.ts', side: 'new', start: 1, end: 3, caption: 'a' },
            ],
            evidence: [],
            files: [],
          },
        ],
        onlyInTranscript: [],
        stillUnclear: [],
      },
    },
  },
  worktreePath: '/repo',
  files: [],
});

async function fixture(
  onTestFinished: (callback: () => Promise<void>) => void,
  pullRequestNumber: number | undefined,
  repositoryRecorded = true,
) {
  const pullRequestRepository =
    pullRequestNumber !== undefined && repositoryRecorded
      ? { owner: 'o', repo: 'r' }
      : undefined;
  const folder = await mkdtemp(join(tmpdir(), 'walkthrough-post-'));
  onTestFinished(() => rm(folder, { recursive: true, force: true }));
  const comments: {
    body: string;
    number: number;
    account: string;
    owner: string;
    repo: string;
  }[] = [];
  let origin: { owner: string; repo: string } | undefined = {
    owner: 'o',
    repo: 'r',
  };
  const gate = await Effect.runPromise(Deferred.make<void>());
  const bothPlanned = await Effect.runPromise(Deferred.make<void>());
  let held = false;
  let planned = 0;
  const commenter = Layer.succeed(PullRequestCommenter, {
    comment: (input) =>
      Effect.gen(function* () {
        comments.push(input);
        if (held) yield* Deferred.await(gate);
        return { url: `https://github.com/o/r/pull/9#c${comments.length}` };
      }),
  });
  let next = 0;
  const database = storageLayer(join(folder, 'data'), {
    worktreeIdLength: 32,
    busyTimeoutMs: 5000,
  }).pipe(Layer.provide(NodeServices.layer));
  const lanes = Layer.mergeAll(
    LaneKeys.layer,
    Lanes.layer.pipe(
      Layer.provide(
        Layer.succeed(LaneOptions, {
          deadlineMs: 60000,
          readCapacity: 2,
          consistency: { execute: () => Effect.void },
        }),
      ),
    ),
  );
  const ports = Layer.mergeAll(
    database,
    commenter,
    lanes,
    Layer.succeed(IdSource, { next: () => `message-${(next += 1)}` }),
    Layer.succeed(EventPublisher, {
      inventoryChanged: () => Effect.void,
      projectChanged: () => Effect.void,
      worktreeChanged: () => Effect.void,
      filesChanged: () => Effect.void,
      gitActionProgressed: () => Effect.void,
      gitActionChanged: () => Effect.void,
    }),
    Layer.succeed(ResolveProjectGitHubUseCasePort, {
      execute: () =>
        Effect.gen(function* () {
          if (held && (planned += 1) === 2)
            yield* Deferred.succeed(bothPlanned, undefined);
          if (held) yield* Deferred.await(bothPlanned);
          return {
            repository: origin,
            selection: {
              accounts: ['fixture'],
              choice: { account: 'fixture', source: 'detected' as const },
              override: undefined,
              unavailable: undefined,
            },
          };
        }),
    }),
  );
  const access = WorktreeAccess.layer.pipe(
    Layer.provide(lanes),
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(CheckWorktreeUseCasePort, {
          execute: () => Effect.succeed(worktree),
        }),
        Layer.succeed(WorktreeConsistencyProbe, {
          execute: () => Effect.void,
        }),
      ),
    ),
  );
  const services = Layer.mergeAll(
    AddWalkthroughMessageService.layer,
    ListWalkthroughConversationsService.layer,
    PostWalkthroughMessagesService.layer.pipe(
      Layer.provideMerge(PlanWalkthroughPostService.layer),
    ),
  ).pipe(Layer.provideMerge(ports));
  const runtime = ManagedRuntime.make(
    PostWalkthroughMessagesUseCase.layer.pipe(
      Layer.provideMerge(services),
      Layer.provideMerge(access),
    ),
  );
  onTestFinished(() => runtime.dispose());
  await runtime.runPromise(
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      yield* store.accept(job(pullRequestNumber, pullRequestRepository));
    }),
  );
  await runtime.runPromise(
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      yield* store.save(job(pullRequestNumber, pullRequestRepository).run);
    }),
  );
  const refresh = (
    id: string,
    number: number,
    repository: { owner: string; repo: string },
  ) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const store = yield* WalkthroughStore;
        yield* store.accept(job(number, repository, id));
        yield* store.save(job(number, repository, id).run);
      }),
    );
  const add = (text: string, saved: boolean, runId = 'run') =>
    runtime.runPromise(
      Effect.gen(function* () {
        const service = yield* AddWalkthroughMessageService;
        const store = yield* WalkthroughStore;
        const id = yield* service.execute({
          worktreeId: 'tree',
          runId,
          anchor: { kind: 'stop', title: 'Keep the retry local' },
          text,
        });
        if (saved) yield* store.saveForLater('tree', id, true);
        return id;
      }),
    );
  const post = (messageId?: string) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const useCase = yield* PostWalkthroughMessagesUseCase;
        return yield* useCase.execute({ worktreeId: 'tree', messageId });
      }),
    );
  const attempt = (messageId: string) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const useCase = yield* PostWalkthroughMessagesUseCase;
        return yield* useCase
          .execute({ worktreeId: 'tree', messageId })
          .pipe(Effect.result);
      }),
    );
  return {
    add,
    refresh,
    post,
    attempt,
    comments,
    setOrigin: (next: typeof origin) => {
      origin = next;
    },
    hold: () => {
      held = true;
    },
    release: () =>
      Effect.runPromise(Deferred.succeed(gate, undefined).pipe(Effect.asVoid)),
  };
}

it('posts a message once and gives both presses the same comment', async ({
  onTestFinished,
}) => {
  const test = await fixture(onTestFinished, 9);
  const id = await test.add('Remove the retry', false);
  test.hold();
  const presses = Promise.all([test.post(id), test.post(id)]);
  await expect.poll(() => test.comments.length).toBe(1);
  await test.release();
  const [first, second] = await presses;
  expect(test.comments).toHaveLength(1);
  expect(test.comments[0]).toMatchObject({ number: 9, account: 'fixture' });
  expect(first?.outcome).toEqual(second?.outcome);
  expect(first?.outcome).toMatchObject({ status: 'posted' });
});

it('does not post an already posted message again later', async ({
  onTestFinished,
}) => {
  const test = await fixture(onTestFinished, 9);
  const id = await test.add('Remove the retry', false);
  const first = await test.post(id);
  const second = await test.post(id);
  expect(test.comments).toHaveLength(1);
  expect(second.outcome).toEqual(first.outcome);
});

it('sends all saved messages as one comment and marks each posted with its URL', async ({
  onTestFinished,
}) => {
  const test = await fixture(onTestFinished, 9);
  await test.add('First decision', true);
  await test.add('Second decision', true);
  await test.add('Not saved', false);
  const posted = await test.post();
  expect(test.comments).toHaveLength(1);
  const body = test.comments[0]?.body ?? '';
  expect(body).toContain('First decision');
  expect(body).toContain('Second decision');
  expect(body).toContain('`src/a.ts`');
  expect(body).not.toContain('Not saved');
  const url = 'https://github.com/o/r/pull/9#c1';
  expect(posted.outcome).toEqual({ status: 'posted', url, notPosted: [] });
  expect(
    posted.view.conversations
      .flatMap((conversation) => conversation.messages)
      .flatMap((message) =>
        message.author === 'developer' ? [message.post] : [],
      ),
  ).toMatchObject([
    { status: 'posted', url },
    { status: 'posted', url },
    { status: 'none' },
  ]);
});

it('posts nothing when nothing is saved', async ({ onTestFinished }) => {
  const test = await fixture(onTestFinished, 9);
  await test.add('Not saved', false);
  const result = await test.post();
  expect(result.outcome).toEqual({ status: 'nothing' });
  expect(test.comments).toEqual([]);
});

it('returns the copyable brief and changes nothing when the walkthrough has no pull request', async ({
  onTestFinished,
}) => {
  const test = await fixture(onTestFinished, undefined);
  const id = await test.add('Remove the retry', true);
  const single = await test.post(id);
  const saved = await test.post();
  const brief =
    'From the walkthrough of this change:\n\n> Remove the retry\n\n**Step:** Keep the retry local (`src/a.ts`)\n';
  expect(single.outcome).toEqual({ status: 'brief', text: brief });
  expect(saved.outcome).toEqual({ status: 'brief', text: brief });
  expect(test.comments).toEqual([]);
  expect(saved.view.conversations[0]?.messages[0]).toMatchObject({
    author: 'developer',
    post: { status: 'saved' },
  });
});

it('refuses to post on another repository after origin changes and keeps the message unposted', async ({
  onTestFinished,
}) => {
  const test = await fixture(onTestFinished, 9);
  const id = await test.add('A private decision', false);
  test.setOrigin({ owner: 'someone', repo: 'public-fork' });
  expect(await test.attempt(id)).toMatchObject({
    _tag: 'Failure',
    failure: {
      _tag: 'WalkthroughRepositoryChangedError',
      message:
        "This walkthrough's pull request is on o/r, but this project's origin no longer points there. Nothing was posted. Copy the brief instead.",
    },
  });
  expect(test.comments).toEqual([]);
  test.setOrigin({ owner: 'o', repo: 'r' });
  expect((await test.post(id)).outcome).toMatchObject({ status: 'posted' });
});

it('refuses when origin is no longer on GitHub', async ({ onTestFinished }) => {
  const test = await fixture(onTestFinished, 9);
  const id = await test.add('A private decision', false);
  test.setOrigin(undefined);
  expect(await test.attempt(id)).toMatchObject({
    _tag: 'Failure',
    failure: { _tag: 'WalkthroughRepositoryChangedError' },
  });
  expect(test.comments).toEqual([]);
});

it('refuses a pull request whose repository was never recorded', async ({
  onTestFinished,
}) => {
  const test = await fixture(onTestFinished, 9, false);
  const id = await test.add('A private decision', false);
  expect(await test.attempt(id)).toMatchObject({
    _tag: 'Failure',
    failure: {
      _tag: 'WalkthroughRepositoryChangedError',
      message:
        "This walkthrough did not record its pull request's repository. Nothing was posted. Copy the brief instead.",
    },
  });
  expect(test.comments).toEqual([]);
});

it('posts to the recorded repository when origin differs only by letter case', async ({
  onTestFinished,
}) => {
  const test = await fixture(onTestFinished, 9);
  const id = await test.add('A decision', false);
  test.setOrigin({ owner: 'O', repo: 'R' });
  await test.post(id);
  expect(test.comments).toMatchObject([{ owner: 'o', repo: 'r', number: 9 }]);
});

it('posts only messages made on the destination repository and leaves the others saved', async ({
  onTestFinished,
}) => {
  const test = await fixture(onTestFinished, 9);
  const old = await test.add('A private decision', true);
  const fork = { owner: 'someone', repo: 'public-fork' };
  test.setOrigin(fork);
  await test.refresh('fork-run', 12, fork);
  const fresh = await test.add('A fork decision', true, 'fork-run');
  const saved = await test.post();
  expect(test.comments).toHaveLength(1);
  expect(test.comments[0]).toMatchObject({ ...fork, number: 12 });
  expect(test.comments[0]?.body).toContain('A fork decision');
  expect(test.comments[0]?.body).not.toContain('A private decision');
  expect(saved.outcome).toEqual({
    status: 'posted',
    url: 'https://github.com/o/r/pull/9#c1',
    notPosted: [old],
  });
  expect(
    saved.view.conversations
      .flatMap((conversation) => conversation.messages)
      .flatMap((message) =>
        message.author === 'developer'
          ? [[message.id, message.post.status]]
          : [],
      ),
  ).toEqual([
    [old, 'saved'],
    [fresh, 'posted'],
  ]);
  expect(await test.attempt(old)).toMatchObject({
    _tag: 'Failure',
    failure: { _tag: 'WalkthroughRepositoryChangedError' },
  });
  expect(test.comments).toHaveLength(1);
});
