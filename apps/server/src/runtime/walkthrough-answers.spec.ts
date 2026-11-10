import { withReadLease } from '@porcelain/effects';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Effect, Layer, ManagedRuntime, Schema } from 'effect';
import { WorkflowEngine } from 'effect/workflow';
import { NodeServices } from '@effect/platform-node';
import { expect, it } from 'vitest';
import { storageLayer } from '@porcelain/storage';
import {
  WalkthroughModelReader,
  EvidenceReader,
  TranscriptReader,
  WalkthroughStore,
} from '@porcelain/walkthroughs/ports';
import {
  AddWalkthroughMessageService,
  ReadWalkthroughTargetService,
  ResolveWalkthroughWriterService,
  AnswerWalkthroughMessageService,
  BeginWalkthroughService,
  ListWalkthroughConversationsService,
  RetryWalkthroughAnswerService,
  WriteWalkthroughService,
} from '@porcelain/walkthroughs/services';
import { IdSource } from '@porcelain/kernel/ports';
import type { WalkthroughJob } from '@porcelain/walkthroughs/models';
import { cliWalkthroughWriterLayer } from '@porcelain/agents/walkthrough-writing';
import { AnnounceWalkthroughUseCasePort } from '../ports/announce-walkthrough-use-case-port.ts';
import { WalkthroughAnswerQueue } from '../ports/walkthrough-answer-queue.ts';
import { LaneOptions } from '../ports/lane-options.ts';
import { LaneKeys } from './lane-keys.ts';
import { Lanes } from './lanes.ts';
import { WalkthroughWorkflow } from './walkthrough-workflow.ts';

const processGroup = { lingerMs: 20, cleanupMs: 1000, pollMs: 5 };
const ready: WalkthroughJob = {
  run: {
    id: 'run',
    projectId: 'project',
    worktreeId: 'worktree',
    pullRequestNumber: undefined,
    baseOid: 'a'.repeat(40),
    headOid: 'b'.repeat(40),
    writer: { provider: 'claude', model: 'claude-opus-5-5', effort: 'high' },
    sessionId: 'writer-session',
    createdAt: '2026-11-09T00:00:00.000Z',
    state: { status: 'queued' },
  },
  worktreePath: '',
  files: [],
};
const content = {
  outcome: 'worth_knowing' as const,
  title: 'Walkthrough',
  summary: 'Summary.',
  growth: [],
  stops: [
    {
      title: 'Keep the retry local',
      explanation: 'Why.',
      excerpts: [],
      evidence: [],
      files: [],
    },
  ],
  onlyInTranscript: [],
  stillUnclear: [],
};

const SCRIPT = (folder: string) => `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const here = ${JSON.stringify(folder)};
const args = process.argv.slice(2);
const prompt = fs.readFileSync(0, 'utf8');
const text = /<comment>\\n([\\s\\S]*?)\\n<\\/comment>/.exec(prompt)?.[1] ?? '';
fs.appendFileSync(path.join(here, 'calls'), JSON.stringify({ text, resume: args.includes('--resume'), pid: process.pid }) + '\\n');
const wait = () => new Promise((resolve) => setTimeout(resolve, 10));
(async () => {
  while (fs.existsSync(path.join(here, 'hold')) && text === fs.readFileSync(path.join(here, 'hold'), 'utf8')) await wait();
  if (fs.existsSync(path.join(here, 'fail'))) { console.error('The tool crashed.'); process.exit(1); }
  console.log(JSON.stringify({ session_id: 'writer-session', total_cost_usd: 0.02, result: 'Answer to: ' + text }));
})();
`;

async function fixture(
  onTestFinished: (callback: () => Promise<void>) => void,
) {
  const folder = await mkdtemp(join(tmpdir(), 'walkthrough-answers-'));
  onTestFinished(() => rm(folder, { recursive: true, force: true }));
  const command = join(folder, 'claude');
  await writeFile(command, SCRIPT(folder), { mode: 0o700 });
  const worktreePath = folder;
  let next = 0;
  const build = () => {
    const database = storageLayer(join(folder, 'data'), {
      worktreeIdLength: 32,
      busyTimeoutMs: 5000,
    }).pipe(Layer.provide(NodeServices.layer));
    const services = Layer.mergeAll(
      WriteWalkthroughService.layer,
      BeginWalkthroughService.layer,
      AnswerWalkthroughMessageService.layer.pipe(
        Layer.provide(ResolveWalkthroughWriterService.layer),
      ),
      AddWalkthroughMessageService.layer,
      RetryWalkthroughAnswerService.layer,
      ListWalkthroughConversationsService.layer,
    ).pipe(
      Layer.provideMerge(ReadWalkthroughTargetService.layer),
      Layer.provideMerge(
        Layer.mergeAll(
          database,
          cliWalkthroughWriterLayer({ processGroup, command }).pipe(
            Layer.provide(
              Layer.succeed(WalkthroughModelReader, {
                read: () =>
                  Effect.succeed([
                    {
                      provider: 'claude',
                      model: 'claude-opus-5-5',
                      label: 'Opus',
                      efforts: ['high'],
                      defaultEffort: 'high',
                    },
                  ]),
              }),
            ),
            Layer.provide(NodeServices.layer),
          ),
          Layer.succeed(TranscriptReader, { read: () => Effect.succeed('') }),
          Layer.succeed(EvidenceReader, {
            read: () =>
              Effect.succeed({
                title: '',
                body: '',
                checks: undefined,
                assets: [],
              }),
          }),
          Layer.succeed(IdSource, { next: () => `message-${(next += 1)}` }),
        ),
      ),
    );
    return WalkthroughWorkflow.layer.pipe(
      Layer.provideMerge(services),
      Layer.provide(WorkflowEngine.layerMemory),
      Layer.provide(
        Layer.succeed(AnnounceWalkthroughUseCasePort, {
          execute: () => Effect.void,
        }),
      ),
      Layer.provide(
        Layer.mergeAll(
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
        ),
      ),
    );
  };
  let runtime = ManagedRuntime.make(build());
  onTestFinished(() => runtime.dispose());
  await runtime.runPromise(
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      yield* store.accept({ ...ready, worktreePath });
      yield* store.save({
        ...ready.run,
        state: {
          status: 'ready',
          content,
          writtenAt: '2026-11-09T00:00:00.000Z',
          durationMs: 1,
        },
      });
    }),
  );
  const add = (text: string, stopTitle?: string) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const service = yield* AddWalkthroughMessageService;
        return yield* withReadLease(
          'worktree',
          service.execute({
            worktreeId: 'worktree',
            runId: 'run',
            anchor:
              stopTitle === undefined
                ? { kind: 'walkthrough' }
                : { kind: 'stop', title: stopTitle },
            text,
          }),
        );
      }),
    );
  const enqueue = () =>
    runtime.runPromise(
      Effect.gen(function* () {
        const queue = yield* WalkthroughAnswerQueue;
        yield* queue.execute();
      }),
    );
  const messages = () =>
    runtime.runPromise(
      Effect.gen(function* () {
        const service = yield* ListWalkthroughConversationsService;
        const view = yield* withReadLease(
          'worktree',
          service.execute({ worktreeId: 'worktree', runId: 'run' }),
        );
        return view.conversations.flatMap(
          (conversation) => conversation.messages,
        );
      }),
    );
  const answer = async (id: string) =>
    (await messages()).find(
      (message) => message.author === 'agent' && message.replyTo === id,
    );
  const calls = async (): Promise<{ text: string; pid: number }[]> =>
    (await readFile(join(folder, 'calls'), 'utf8').catch(() => ''))
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) =>
        Schema.decodeUnknownSync(
          Schema.fromJsonString(
            Schema.Struct({ text: Schema.String, pid: Schema.Number }),
          ),
        )(line),
      );
  return {
    folder,
    add,
    enqueue,
    answer,
    calls,
    settled: async (id: string) => {
      await expect
        .poll(
          async () => {
            const message = await answer(id);
            return message?.author === 'agent' ? message.state.status : '';
          },
          { timeout: 5000 },
        )
        .not.toBe('answering');
      return answer(id);
    },
    retry: (id: string) =>
      runtime.runPromise(
        Effect.gen(function* () {
          const service = yield* RetryWalkthroughAnswerService;
          return yield* service.execute({
            worktreeId: 'worktree',
            runId: 'run',
            messageId: id,
          });
        }),
      ),
    restart: async () => {
      await runtime.dispose();
      runtime = ManagedRuntime.make(build());
      await runtime.runPromise(
        Effect.gen(function* () {
          const workflow = yield* WalkthroughWorkflow;
          yield* workflow.recover();
        }),
      );
    },
  };
}

it('answers one message once, however many times the queue is told about it', async ({
  onTestFinished,
}) => {
  const test = await fixture(onTestFinished);
  const id = await test.add('Why is the retry here?', 'Keep the retry local');
  await Promise.all([test.enqueue(), test.enqueue()]);
  await expect.poll(test.calls, { timeout: 5000 }).toHaveLength(1);
  const message = await test.settled(id);
  expect(message).toMatchObject({
    author: 'agent',
    replyTo: id,
    state: {
      status: 'answered',
      text: 'Answer to: Why is the retry here?',
      costUsd: 0.02,
    },
  });
  const later = await test.add('A later question');
  await test.enqueue();
  await test.settled(later);
  expect((await test.calls()).map((call) => call.text)).toEqual([
    'Why is the retry here?',
    'A later question',
  ]);
});

it('answers quick messages in the order they were asked', async ({
  onTestFinished,
}) => {
  const test = await fixture(onTestFinished);
  const first = await test.add('First');
  await writeFile(join(test.folder, 'hold'), 'First');
  await test.enqueue();
  await expect
    .poll(async () => (await test.calls()).map((call) => call.text), {
      timeout: 5000,
    })
    .toEqual(['First']);
  const second = await test.add('Second');
  const third = await test.add('Third');
  await Promise.all([test.enqueue(), test.enqueue()]);
  await rm(join(test.folder, 'hold'));
  await test.settled(third);
  await test.settled(first);
  await test.settled(second);
  expect((await test.calls()).map((call) => call.text)).toEqual([
    'First',
    'Second',
    'Third',
  ]);
});

it('lets a failed answer be asked again and answers it', async ({
  onTestFinished,
}) => {
  const test = await fixture(onTestFinished);
  await writeFile(join(test.folder, 'fail'), '');
  const id = await test.add('Will this crash?');
  await test.enqueue();
  expect(await test.settled(id)).toMatchObject({
    state: { status: 'failed', failure: { kind: 'other' } },
  });
  await rm(join(test.folder, 'fail'));
  expect(await test.retry(id)).toBe(true);
  await test.enqueue();
  await expect
    .poll(
      async () => {
        const message = await test.answer(id);
        return message?.author === 'agent' ? message.state.status : '';
      },
      { timeout: 5000 },
    )
    .toBe('answered');
});

it('turns an answer interrupted by a restart into a failure that can be asked again', async ({
  onTestFinished,
}) => {
  const test = await fixture(onTestFinished);
  await writeFile(join(test.folder, 'hold'), 'Interrupted');
  const running = await test.add('Interrupted');
  const waiting = await test.add('Waiting');
  await test.enqueue();
  await expect.poll(test.calls, { timeout: 5000 }).toHaveLength(1);
  await test.restart();
  const interrupted = {
    state: {
      status: 'failed',
      failure: {
        kind: 'other',
        message: 'This answer was interrupted. Ask again.',
      },
    },
  };
  expect(await test.answer(running)).toMatchObject(interrupted);
  expect(await test.answer(waiting)).toMatchObject(interrupted);
  const [held] = await test.calls();
  expect(() => process.kill(held?.pid ?? -1, 0)).toThrow();
  await rm(join(test.folder, 'hold'));
  await test.retry(running);
  await test.enqueue();
  await expect
    .poll(
      async () => {
        const message = await test.answer(running);
        return message?.author === 'agent' ? message.state.status : '';
      },
      { timeout: 5000 },
    )
    .toBe('answered');
});
