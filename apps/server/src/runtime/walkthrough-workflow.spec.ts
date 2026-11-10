import { WalkthroughModelReader } from '@porcelain/walkthroughs/ports';
import { Lanes } from './lanes.ts';
import { LaneKeys } from './lane-keys.ts';
import { LaneOptions } from '../ports/lane-options.ts';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { Effect, Deferred, Layer, ManagedRuntime } from 'effect';
import { WorkflowEngine } from 'effect/workflow';
import { SqlClient } from 'effect/sql';
import { NodeServices } from '@effect/platform-node';
import { expect, it, onTestFinished } from 'vitest';
import { storageLayer } from '@porcelain/storage';
import {
  WalkthroughStore,
  EvidenceReader,
  TranscriptReader,
} from '@porcelain/walkthroughs/ports';
import type { WalkthroughJob } from '@porcelain/walkthroughs/models';
import {
  WriteWalkthroughService,
  BeginWalkthroughService,
  AnswerWalkthroughMessageService,
  ResolveWalkthroughWriterService,
} from '@porcelain/walkthroughs/services';
import { cliWalkthroughWriterLayer } from '@porcelain/agents/walkthrough-writing';
import { AnnounceWalkthroughUseCasePort } from '../ports/announce-walkthrough-use-case-port.ts';
import { WalkthroughWorkflow } from './walkthrough-workflow.ts';
const processGroup = { lingerMs: 20, cleanupMs: 1000, pollMs: 5 };
it('accepts one durable active run per head, serializes writers, drains foreign processes and defines restart recovery without losing evidence', async ({
  onTestFinished,
}) => {
  const folder = await mkdtemp(join(tmpdir(), 'walkthrough-durable-'));
  onTestFinished(() => rm(folder, { recursive: true, force: true }));
  const repo = join(folder, 'repository');
  execFileSync('git', ['init', '-q', repo]);
  execFileSync('git', [
    '-C',
    repo,
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.com',
    '-c',
    'core.hooksPath=/dev/null',
    'commit',
    '-qm',
    'Initial',
    '--allow-empty',
  ]);
  const head = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  const job: WalkthroughJob = {
    run: {
      id: 'first',
      projectId: 'project',
      worktreeId: 'worktree',
      pullRequestNumber: undefined,
      baseOid: head,
      headOid: head,
      writer: { provider: 'claude', model: 'fixture', effort: 'high' },
      sessionId: undefined,
      createdAt: '2026-11-09T00:00:00Z',
      state: { status: 'queued' },
    },
    worktreePath: repo,
    files: [],
  };
  const command = join(folder, 'writer');
  await writeFile(
    command,
    '#!/usr/bin/env node\n' +
      `const fs = require('fs'); fs.writeFileSync('started', String(process.pid)); setInterval(() => {}, 1000);`,
    { mode: 0o700 },
  );
  const notices: string[] = [];
  const secondStarted = await Effect.runPromise(Deferred.make<void>());
  const events = Layer.succeed(AnnounceWalkthroughUseCasePort, {
    execute: (notice) =>
      Effect.gen(function* () {
        notices.push(notice.worktreeId);
        if (notice.worktreeId === 'second-worktree')
          yield* Deferred.succeed(secondStarted, undefined);
      }),
  });
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
  ).pipe(
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
                    model: 'fixture',
                    label: 'Opus',
                    efforts: ['high'],
                    defaultEffort: 'high',
                  },
                ]),
            }),
          ),
          Layer.provide(NodeServices.layer),
        ),
        Layer.succeed(TranscriptReader, {
          read: () => Effect.succeed('Intent stays in memory'),
        }),
        Layer.succeed(EvidenceReader, {
          read: () =>
            Effect.succeed({
              title: '',
              body: '',
              checks: undefined,
              assets: [
                {
                  id: 'image',
                  mediaType: 'image/png',
                  caption: 'Existing evidence',
                  bytes: new Uint8Array([1, 2, 3]),
                },
              ],
            }),
        }),
      ),
    ),
  );
  const layers = WalkthroughWorkflow.layer.pipe(
    Layer.provideMerge(services),
    Layer.provide(WorkflowEngine.layerMemory),
    Layer.provide(events),
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
  let runtime = ManagedRuntime.make(layers);
  onTestFinished(() => runtime.dispose());
  const accepted = await runtime.runPromise(
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      return yield* Effect.all(
        [
          store.accept(job),
          store.accept({ ...job, run: { ...job.run, id: 'duplicate' } }),
        ],
        { concurrency: 2 },
      );
    }),
  );
  expect(accepted.map((run) => run.id)).toEqual(['first', 'first']);
  const marker = new Promise<void>((resolve) => {
    const watcher = watch(repo, (_event, name) => {
      if (name === 'started') {
        watcher.close();
        resolve();
      }
    });
    onTestFinished(async () => {
      watcher.close();
    });
  });
  await runtime.runPromise(
    Effect.gen(function* () {
      const workflow = yield* WalkthroughWorkflow;
      yield* workflow.execute('first');
      yield* workflow.execute('first');
    }),
  );
  await marker;
  const pid = Number(await readFile(join(repo, 'started'), 'utf8'));
  const statuses = await runtime.runPromise(
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      yield* store.accept({
        ...job,
        run: { ...job.run, id: 'second', worktreeId: 'second-worktree' },
      });
      const workflow = yield* WalkthroughWorkflow;
      yield* workflow.execute('second');
      return [
        (yield* store.read('worktree'))?.state.status,
        (yield* store.read('second-worktree'))?.state.status,
      ];
    }),
  );
  expect(statuses).toEqual(['running', 'queued']);
  await runtime.dispose();
  expect(() => process.kill(pid, 0)).toThrow();
  runtime = ManagedRuntime.make(layers);
  const recovered = await runtime.runPromise(
    Effect.gen(function* () {
      const workflow = yield* WalkthroughWorkflow;
      yield* workflow.recover();
      const store = yield* WalkthroughStore;
      return {
        first: yield* store.read('worktree'),
        readAsset: yield* store.readAsset('first', 'image', 'worktree'),
        otherAsset: yield* store.readAsset('first', 'image', 'second-worktree'),
        duplicate: yield* store.accept({
          ...job,
          run: { ...job.run, id: 'third' },
        }),
      };
    }),
  );
  expect(recovered.first?.state).toEqual({
    status: 'failed',
    failure: {
      kind: 'other',
      message:
        'The server stopped while this walkthrough was running. The interrupted writer was not restarted.',
    },
  });
  expect(recovered.readAsset?.bytes).toEqual(new Uint8Array([1, 2, 3]));
  await runtime.runPromise(Deferred.await(secondStarted));
  const queuedAfterRestart = await runtime.runPromise(
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      return yield* store.read('second-worktree');
    }),
  );
  expect(queuedAfterRestart?.state.status).toBe('running');
  expect(recovered.otherAsset).toBeUndefined();
  expect(recovered.duplicate.id).toBe('third');
  expect(recovered.duplicate.sessionId).toBeUndefined();
  expect(notices).toContain('worktree');
});

it.each(['signed_out', 'other'] as const)(
  'starts a new attempt after %s failure and shares queued, running and ready attempts for that head',
  async (kind) => {
    const folder = await mkdtemp(join(tmpdir(), 'walkthrough-retry-'));
    onTestFinished(() => rm(folder, { recursive: true, force: true }));
    const repo = join(folder, 'repository');
    execFileSync('git', ['init', '-q', repo]);
    execFileSync('git', [
      '-C',
      repo,
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.invalid',
      '-c',
      'core.hooksPath=/dev/null',
      'commit',
      '-qm',
      'Initial',
      '--allow-empty',
    ]);
    const headOid = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
    const job: WalkthroughJob = {
      run: {
        id: 'failed',
        projectId: 'project',
        worktreeId: 'worktree',
        baseOid: headOid,
        headOid,
        writer: { provider: 'claude', model: 'fixture', effort: 'high' },
        createdAt: '2026-11-09T00:00:00Z',
        state: { status: 'queued' },
      },
      worktreePath: repo,
      files: [],
    };
    const command = join(folder, 'writer');
    await writeFile(
      command,
      '#!/usr/bin/env node\n' +
        `const fs = require('fs'); const args = process.argv.slice(2); fs.readFileSync(0, 'utf8'); const resumed = args.includes('--resume'); const session = args[args.indexOf(resumed ? '--resume' : '--session-id') + 1]; fs.appendFileSync('calls', resumed ? 'second\\n' : 'first\\n'); console.log(JSON.stringify({session_id:session,structured_output:resumed ? {outcome:'nothing',title:'A small change',summary:'The retry finished.',growth:[],stops:[],onlyInTranscript:[],stillUnclear:[],checks:null} : {understood:'A small change',could_not_tell:[]}}));`,
      { mode: 0o700 },
    );
    const runtime = ManagedRuntime.make(
      Layer.mergeAll(
        BeginWalkthroughService.layer,
        WriteWalkthroughService.layer,
      ).pipe(
        Layer.provideMerge(
          Layer.mergeAll(
            storageLayer(join(folder, 'data'), {
              worktreeIdLength: 32,
              busyTimeoutMs: 5000,
            }).pipe(Layer.provide(NodeServices.layer)),
            cliWalkthroughWriterLayer({ processGroup, command }).pipe(
              Layer.provide(
                Layer.succeed(WalkthroughModelReader, {
                  read: () =>
                    Effect.succeed([
                      {
                        provider: 'claude',
                        model: 'fixture',
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
          ),
        ),
      ),
    );
    onTestFinished(() => runtime.dispose());
    await runtime.runPromise(
      Effect.gen(function* () {
        const store = yield* WalkthroughStore;
        yield* store.accept(job);
        yield* store.save({
          ...job.run,
          state: {
            status: 'failed',
            failure: {
              kind,
              message:
                kind === 'signed_out'
                  ? 'Sign in again.'
                  : 'The server interrupted the writer.',
            },
          },
        });
      }),
    );
    const queued = await runtime.runPromise(
      Effect.gen(function* () {
        const store = yield* WalkthroughStore;
        return yield* Effect.all(
          [
            store.accept({ ...job, run: { ...job.run, id: 'retry' } }),
            store.accept({
              ...job,
              run: { ...job.run, id: 'duplicate-queued' },
            }),
          ],
          { concurrency: 2 },
        );
      }),
    );
    expect(queued.map((run) => run.id)).toEqual(['retry', 'retry']);
    expect(queued.map((run) => run.state.status)).toEqual(['queued', 'queued']);
    const latestQueued = await runtime.runPromise(
      Effect.gen(function* () {
        const store = yield* WalkthroughStore;
        return yield* store.read('worktree');
      }),
    );
    expect(latestQueued?.id).toBe('retry');
    const running = await runtime.runPromise(
      Effect.gen(function* () {
        const begin = yield* BeginWalkthroughService;
        yield* begin.execute('retry');
        const store = yield* WalkthroughStore;
        return yield* Effect.all(
          [
            store.accept({
              ...job,
              run: { ...job.run, id: 'duplicate-running' },
            }),
            store.accept({ ...job, run: { ...job.run, id: 'another-press' } }),
          ],
          { concurrency: 2 },
        );
      }),
    );
    expect(running.map((run) => run.id)).toEqual(['retry', 'retry']);
    expect(running.map((run) => run.state.status)).toEqual([
      'running',
      'running',
    ]);
    const ready = await runtime.runPromise(
      Effect.gen(function* () {
        const writer = yield* WriteWalkthroughService;
        yield* writer.execute({ ...job, run: { ...job.run, id: 'retry' } });
        const store = yield* WalkthroughStore;
        return {
          attempts: yield* (yield* SqlClient.SqlClient)<{
            id: string;
            status: string;
          }>`SELECT id, status FROM walkthrough_runs ORDER BY sequence`.pipe(
            Effect.orDie,
          ),
          latest: yield* store.read('worktree'),
          repeated: yield* store.accept({
            ...job,
            run: { ...job.run, id: 'after-ready' },
          }),
        };
      }),
    );
    expect(ready.attempts).toEqual([
      { id: 'failed', status: 'failed' },
      { id: 'retry', status: 'ready' },
    ]);
    expect(ready.latest?.id).toBe('retry');
    expect(ready.latest?.state).toMatchObject({
      status: 'ready',
      content: { outcome: 'nothing', summary: 'The retry finished.' },
    });
    expect(ready.repeated.id).toBe('retry');
    expect(ready.repeated.state.status).toBe('ready');
    expect(await readFile(join(repo, 'calls'), 'utf8')).toBe('first\nsecond\n');
  },
);
