import { NodeServices } from '@effect/platform-node';
import { ReviewAgentHost } from '@porcelain/reviews/ports';
import { ConfigProvider, Effect, Layer, ManagedRuntime } from 'effect';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { LIMITS } from '../../config/limits.ts';
import { t3ReviewAgentHostLayer } from './t3-review-agent-host.ts';

const input = {
  reviewId: 'review',
  session: { kind: 't3', threadId: 'owned-thread' },
  worktreePath: '/owned/worktree',
  kind: 'send',
  message: 'Exact notification: $(never a shell command)',
} as const;
const target = {
  thread: {
    threadId: 'owned-thread',
    worktreePath: '/owned/worktree',
    archived: false,
    pendingRequestCount: 0,
    status: 'working',
  },
};
const receipt = {
  threadId: 'owned-thread',
  runId: 'queued-run',
  messageId: 'queued-message',
  delivery: 'queued',
};
let directory: string;
const makeRuntime = (directory: string) =>
  ManagedRuntime.make(
    Layer.mergeAll(
      t3ReviewAgentHostLayer(LIMITS.git),
      ConfigProvider.layer(ConfigProvider.fromUnknown({ PATH: directory })),
    ).pipe(Layer.provide(NodeServices.layer)),
  );
let runtime: ReturnType<typeof makeRuntime>;
async function configure(
  thread: Omit<typeof target.thread, 'worktreePath'> & {
    worktreePath: string | null;
  } = target.thread,
  response: unknown = receipt,
  members: readonly { threadId: string }[] = [
    { threadId: input.session.threadId },
  ],
) {
  await writeFile(
    join(directory, 'response.json'),
    JSON.stringify({ thread, response, members }),
  );
}
async function outcome() {
  return runtime.runPromise(
    Effect.gen(function* () {
      const host = yield* ReviewAgentHost;
      return yield* host.execute(input);
    }).pipe(Effect.flip),
  );
}
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'porcelain-t3-host-'));
  await writeFile(
    join(directory, 't3'),
    `#!${process.execPath}\nconst fs=require('node:fs');const path=require('node:path');const dir=path.dirname(process.argv[1]);const config=JSON.parse(fs.readFileSync(path.join(dir,'response.json'),'utf8'));const args=process.argv.slice(2);if(args[0]!=='thread')process.exit(2);if(args[1]==='list'){fs.writeFileSync(path.join(dir,'project-args.json'),JSON.stringify(args));console.log(JSON.stringify(config.members));}else if(args[1]==='show'){console.log(JSON.stringify({thread:config.thread}));}else if(args[1]==='send'){const message=fs.readFileSync(0,'utf8');fs.writeFileSync(path.join(dir,'outbox.json'),JSON.stringify({args,message}));console.log(JSON.stringify(config.response));}else process.exit(2);`,
    { mode: 0o700 },
  );
  await configure();
  runtime = makeRuntime(directory);
});
afterEach(async () => {
  await runtime.dispose();
  await rm(directory, { recursive: true, force: true });
});

it('queues the literal notification through stdin for the exact busy session and validates its receipt', async () => {
  await runtime.runPromise(
    Effect.gen(function* () {
      const host = yield* ReviewAgentHost;
      yield* host.execute(input);
    }),
  );
  expect(
    JSON.parse(await readFile(join(directory, 'outbox.json'), 'utf8')),
  ).toEqual({
    args: ['thread', 'send', 'owned-thread', '-', '--json'],
    message: 'Exact notification: $(never a shell command)',
  });
});

it.each([
  {
    name: 'wrong thread',
    changes: { threadId: 'another-thread' },
    reason: 'recipient-mismatch',
  },
  {
    name: 'wrong worktree',
    changes: { worktreePath: '/different/worktree' },
    reason: 'recipient-mismatch',
  },
  {
    name: 'archived session',
    changes: { archived: true },
    reason: 'recipient-unavailable',
  },
  {
    name: 'invalid pending-input count',
    changes: { pendingRequestCount: -1 },
    reason: 'recipient-unavailable',
  },
  {
    name: 'pending user input',
    changes: { pendingRequestCount: 1 },
    reason: 'recipient-unavailable',
  },
])('refuses $name before sending any input', async ({ changes, reason }) => {
  await configure({ ...target.thread, ...changes });
  expect(await outcome()).toMatchObject({
    _tag: 'AgentFeedbackConflictError',
    reason,
  });
  await expect(
    readFile(join(directory, 'outbox.json'), 'utf8'),
  ).rejects.toMatchObject({ code: 'ENOENT' });
});

it('does not confirm a successful command whose returned recipient differs', async () => {
  await configure(target.thread, { ...receipt, threadId: 'another-thread' });
  expect(await outcome()).toMatchObject({
    _tag: 'AgentFeedbackConflictError',
    reason: 'recipient-mismatch',
  });
  expect(
    JSON.parse(await readFile(join(directory, 'outbox.json'), 'utf8')),
  ).toMatchObject({ message: input.message });
});

it.each([
  {
    name: 'missing identifiers',
    response: { threadId: 'owned-thread', delivery: 'queued' },
  },
  { name: 'empty run identifier', response: { ...receipt, runId: '' } },
  { name: 'empty message identifier', response: { ...receipt, messageId: '' } },
])(
  'does not confirm $name even if the external command executed',
  async ({ response }) => {
    await configure(target.thread, response);
    expect(await outcome()).toMatchObject({
      _tag: 'AgentFeedbackConflictError',
      reason: 'recipient-unavailable',
    });
    expect(
      JSON.parse(await readFile(join(directory, 'outbox.json'), 'utf8')),
    ).toMatchObject({ message: input.message });
  },
);

it('does not launch ambient T3 when the fixture explicitly disables agent lookup', async () => {
  const result = await runtime.runPromise(
    Effect.gen(function* () {
      const host = yield* ReviewAgentHost;
      return yield* host.execute(input);
    }).pipe(
      Effect.provide(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown({
            PATH: directory,
            PORCELAIN_CODING_TOOL_DIRECTORY: 'none',
          }),
        ),
      ),
      Effect.result,
    ),
  );
  expect(result).toMatchObject({
    _tag: 'Failure',
    failure: {
      _tag: 'AgentFeedbackConflictError',
      reason: 'recipient-unavailable',
    },
  });
  await expect(
    readFile(join(directory, 'outbox.json'), 'utf8'),
  ).rejects.toMatchObject({ code: 'ENOENT' });
});

it('connects a project thread to a shell-created worktree only after checking repository membership', async () => {
  const main = join(directory, 'main');
  const checkout = join(directory, 'checkout');
  const git = promisify(execFile);
  await git('git', ['init', main]);
  await git('git', [
    '-C',
    main,
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.test',
    'commit',
    '--allow-empty',
    '-m',
    'Base',
  ]);
  await git('git', ['-C', main, 'worktree', 'add', '-b', 'review', checkout]);
  await configure({ ...target.thread, worktreePath: null });
  await runtime.runPromise(
    Effect.gen(function* () {
      const host = yield* ReviewAgentHost;
      yield* host.execute({ ...input, worktreePath: checkout });
    }),
  );
  expect(
    JSON.parse(await readFile(join(directory, 'project-args.json'), 'utf8')),
  ).toEqual(['thread', 'list', '--project', main, '--json']);
  expect(
    JSON.parse(await readFile(join(directory, 'outbox.json'), 'utf8')),
  ).toMatchObject({ message: input.message });
  await configure({ ...target.thread, worktreePath: null }, receipt, [
    { threadId: 'unrelated-project-thread' },
  ]);
  await rm(join(directory, 'outbox.json'));
  const rejected = await runtime.runPromise(
    Effect.gen(function* () {
      const host = yield* ReviewAgentHost;
      return yield* host.execute({ ...input, worktreePath: checkout });
    }).pipe(Effect.flip),
  );
  expect(rejected).toMatchObject({ reason: 'recipient-mismatch' });
  await expect(
    readFile(join(directory, 'outbox.json'), 'utf8'),
  ).rejects.toMatchObject({ code: 'ENOENT' });
});
