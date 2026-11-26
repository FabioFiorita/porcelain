import { temporaryRoot } from '@porcelain/kernel/test-kit/temporary-root';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Effect, Exit, Layer, ManagedRuntime } from 'effect';
import { WorkflowEngine } from 'effect/workflow';
import { NodeServices } from '@effect/platform-node';
import { expect, it, onTestFinished } from 'vite-plus/test';
import { storageLayer } from '@porcelain/storage';
import { IdSource } from '@porcelain/kernel/ports';
import type { ListedWorktree } from '@porcelain/projects/models';
import type {
  WalkthroughContent,
  WalkthroughJob,
} from '@porcelain/walkthroughs/models';
import {
  EvidenceReader,
  TranscriptReader,
  WalkthroughSourceReader,
  WalkthroughStore,
  WalkthroughWriter,
  WalkthroughModelReader,
} from '@porcelain/walkthroughs/ports';
import {
  AddWalkthroughMessageService,
  AnswerWalkthroughMessageService,
  BeginWalkthroughService,
  ListWalkthroughConversationsService,
  ReadWalkthroughTargetService,
  ResolveWalkthroughWriterService,
  RetryWalkthroughAnswerService,
  StartWalkthroughService,
  WriteWalkthroughService,
} from '@porcelain/walkthroughs/services';
import { AnnounceWalkthroughUseCasePort } from '../../ports/announce-walkthrough-use-case-port.ts';
import { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { LaneOptions } from '../../ports/lane-options.ts';
import { WorktreeConsistencyProbe } from '../../ports/worktree-consistency-probe.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { WalkthroughWorkflow } from '../../runtime/walkthrough-workflow.ts';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { AddWalkthroughMessageUseCase } from './add-walkthrough-message.ts';
import { QueueWalkthroughUseCase } from './queue-walkthrough.ts';
import { RetryWalkthroughAnswerUseCase } from './retry-walkthrough-answer.ts';

const content: WalkthroughContent = {
  version: 1 as const,
  outcome: 'worth_knowing',
  title: 'The captured change',
  summary: 'Summary.',
  growth: [],
  stops: [],
  onlyInTranscript: [],
  stillUnclear: [],
};

const worktree: ListedWorktree = {
  id: 'worktree',
  projectId: 'project',
  repositoryId: 'repository',
  path: '/disposable',
  branch: 'refs/heads/main',
  available: true,
  main: true,
  administrativeDirectory: '/disposable/.git',
  commonDirectory: '/disposable/.git',
  metadataIdentity: 'directory',
  repositoryIdentity: 'repository',
};

const snapshot = {
  baseOid: 'a'.repeat(40),
  headOid: 'b'.repeat(40),
  contentTreeOid: 'c'.repeat(40),
  baseRef: 'refs/heads/main',
  includesUncommitted: false,
  branch: worktree.branch,
  files: [],
  patch: '',
  githubRepository: undefined,
};
const ready: WalkthroughJob = {
  run: {
    id: 'ready',
    projectId: worktree.projectId,
    worktreeId: worktree.id,
    pullRequestNumber: undefined,
    ...snapshot,
    writer: { provider: 'claude', model: 'fixture', effort: 'high' },
    createdAt: '2026-11-10T00:00:00Z',
    state: {
      status: 'ready',
      content,
      writtenAt: '2026-11-10T00:00:00Z',
      durationMs: 1,
    },
  },
  worktreePath: worktree.path,
  files: [],
  patch: '',
};

it.each(['start', 'ask', 'retry'] as const)(
  'dispatches %s after the request disconnects at durable acceptance',
  async (action) => {
    const directory = await mkdtemp(
      join(temporaryRoot, 'walkthrough-acceptance-'),
    );
    onTestFinished(() => rm(directory, { recursive: true, force: true }));
    const response = new AbortController();
    const saved = Promise.withResolvers<void>();
    const resume = Promise.withResolvers<void>();
    const persisted = Effect.promise(() => {
      saved.resolve();
      return resume.promise;
    });
    const database = storageLayer(directory, {
      worktreeIdLength: 32,
      busyTimeoutMs: 5000,
    }).pipe(Layer.provide(NodeServices.layer));
    const storage = ManagedRuntime.make(database);
    onTestFinished(() => storage.dispose());
    const store = await storage.runPromise(WalkthroughStore);
    if (action !== 'start') {
      await Effect.runPromise(
        store.accept(ready).pipe(Effect.andThen(store.save(ready.run))),
      );
      if (action === 'retry') {
        await Effect.runPromise(
          store
            .addMessage({
              id: 'retry',
              worktreeId: worktree.id,
              runId: ready.run.id,
              stopTitle: undefined,
              text: 'Why here?',
              createdAt: '2026-11-10T00:00:01Z',
              answer: { status: 'answering' },
            })
            .pipe(
              Effect.andThen(
                store.settleAnswer('retry', {
                  status: 'failed',
                  failure: { kind: 'other', message: 'Try again.' },
                }),
              ),
            ),
        );
      }
    }
    const delayedStore = Layer.succeed(WalkthroughStore, {
      ...store,
      accept: (job, key) =>
        store.accept(job, key).pipe(Effect.tap(() => persisted)),
      addMessage: (message) =>
        store.addMessage(message).pipe(Effect.tap(() => persisted)),
      requeueAnswer: (worktreeId, id) =>
        store.requeueAnswer(worktreeId, id).pipe(Effect.tap(() => persisted)),
    });
    const providerCalls: string[] = [];
    const writer = Layer.succeed(WalkthroughWriter, {
      write: ({ run }) =>
        Effect.sync(() => {
          providerCalls.push(run.id);
          return {
            content,
            sessionId: 'session',
            durationMs: 1,
            costUsd: undefined,
          };
        }),
      answer: ({ text }) =>
        Effect.sync(() => {
          providerCalls.push(text);
          return {
            text: `Answer to ${text}`,
            sessionId: 'session',
            durationMs: 1,
            costUsd: undefined,
          };
        }),
    });
    const services = Layer.mergeAll(
      StartWalkthroughService.layer,
      AddWalkthroughMessageService.layer,
      RetryWalkthroughAnswerService.layer,
      ListWalkthroughConversationsService.layer,
      AnswerWalkthroughMessageService.layer,
      BeginWalkthroughService.layer,
      WriteWalkthroughService.layer,
    ).pipe(
      Layer.provide(
        Layer.mergeAll(
          ReadWalkthroughTargetService.layer,
          ResolveWalkthroughWriterService.layer,
        ),
      ),
      Layer.provide(
        Layer.mergeAll(
          delayedStore,
          writer,
          Layer.succeed(IdSource, { next: () => 'accepted' }),
          Layer.succeed(WalkthroughSourceReader, {
            read: () => Effect.succeed(snapshot),
          }),
          Layer.succeed(TranscriptReader, { read: () => Effect.succeed('') }),
          Layer.succeed(EvidenceReader, {
            read: () => Effect.die('No captured pull request repository'),
          }),
          Layer.succeed(WalkthroughModelReader, {
            read: () => Effect.succeed([]),
          }),
        ),
      ),
    );
    const consistency = { execute: () => Effect.void };
    const lanes = Lanes.layer.pipe(
      Layer.provide(
        Layer.succeed(LaneOptions, {
          readCapacity: 2,
          deadlineMs: 10000,
          consistency,
        }),
      ),
    );
    const application = Layer.mergeAll(
      WorktreeAccess.layer,
      WalkthroughWorkflow.layer,
    ).pipe(
      Layer.provideMerge(services),
      Layer.provide(
        Layer.mergeAll(
          lanes,
          LaneKeys.layer,
          WorkflowEngine.layerMemory,
          Layer.succeed(CheckWorktreeUseCasePort, {
            execute: () => Effect.succeed(worktree),
          }),
          Layer.succeed(WorktreeConsistencyProbe, consistency),
          Layer.succeed(AnnounceWalkthroughUseCasePort, {
            execute: () => Effect.void,
          }),
          delayedStore,
        ),
      ),
    );
    const runtime = ManagedRuntime.make(
      Layer.mergeAll(
        QueueWalkthroughUseCase.layer,
        AddWalkthroughMessageUseCase.layer,
        RetryWalkthroughAnswerUseCase.layer,
      ).pipe(
        Layer.provide(
          Layer.mergeAll(
            application,
            Layer.succeed(EventPublisher, {
              inventoryChanged: () => Effect.void,
              projectChanged: () => Effect.void,
              worktreeChanged: () => Effect.void,
              filesChanged: () => Effect.void,
              gitActionProgressed: () => Effect.void,
              gitActionChanged: () => Effect.void,
            }),
          ),
        ),
      ),
    );
    onTestFinished(async () => {
      resume.resolve();
      await runtime.dispose();
    });
    const request = runtime.runPromiseExit(
      Effect.gen(function* () {
        if (action === 'start') {
          const start = yield* QueueWalkthroughUseCase;
          yield* start.execute({
            worktreeId: worktree.id,
            base: snapshot.baseRef,
            writer: ready.run.writer,
            pullRequestNumber: 702,
          });
        } else if (action === 'ask') {
          const ask = yield* AddWalkthroughMessageUseCase;
          yield* ask.execute({
            worktreeId: worktree.id,
            runId: ready.run.id,
            anchor: { kind: 'walkthrough' },
            text: 'Why here?',
          });
        } else {
          const retry = yield* RetryWalkthroughAnswerUseCase;
          yield* retry.execute({
            worktreeId: worktree.id,
            runId: ready.run.id,
            messageId: 'retry',
          });
        }
      }),
      { signal: response.signal },
    );
    await Promise.race([
      saved.promise,
      request.then((exit) => {
        expect.fail(`Request settled before persistence: ${String(exit)}`);
      }),
    ]);
    response.abort();
    expect(Exit.isFailure(await request)).toBe(true);
    resume.resolve();

    if (action === 'start') {
      await expect
        .poll(
          async () =>
            (await Effect.runPromise(store.readJob('accepted')))?.run.state
              .status,
        )
        .toBe('ready');
      expect(await Effect.runPromise(store.readJob('accepted'))).toMatchObject({
        run: {
          pullRequestNumber: 702,
          evidenceUnavailable: 'github_unavailable',
        },
      });
      expect(providerCalls).toEqual(['accepted']);
    } else {
      const id = action === 'retry' ? 'retry' : 'accepted';
      await expect
        .poll(
          async () =>
            (await Effect.runPromise(store.readMessage(worktree.id, id)))
              ?.answer.status,
        )
        .toBe('answered');
      expect(providerCalls).toEqual(['Why here?']);
    }
  },
);
