import { expect, test } from 'vitest';
import { Effect, Layer, Schema } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { readBranchBases, readBranchChanges } from '@porcelain/client/changes';
import {
  createWorktreeConnection,
  type Transport,
} from '@porcelain/client/transport';
import { scheduledRegistry } from '../../../spec/kit/atom-registry';
import { readServiceUpdateResponseSchema } from '@porcelain/contracts/access';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { readTextFileResponseSchema } from '@porcelain/contracts/files';
import {
  readChangesResponseSchema,
  listReviewedFilesResponseSchema,
  listFileCommitsResponseSchema,
  readCommitDiffsResponseSchema,
} from '@porcelain/contracts/changes';
import {
  walkthroughConversationsResponseSchema,
  readWalkthroughResponseSchema,
} from '@porcelain/contracts/walkthroughs';
import { createDemoTransport } from './demo-transport';

const worktree = '/api/worktrees/9e939510f914ca5886ccab463c94166f';
const request = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});

async function readDemoChanges(send: Transport) {
  return Schema.decodeUnknownSync(readChangesResponseSchema)(
    await (await send(`${worktree}/changes`)).json(),
  );
}

test('the demo computer has no managed service or update to install', async () => {
  const response = await createDemoTransport()('/api/service/update');
  expect(response.status).toBe(200);
  const update = Schema.decodeUnknownSync(readServiceUpdateResponseSchema)(
    await response.json(),
  );
  expect(update).toMatchObject({
    managed: false,
    available: false,
    canUpdate: false,
    running: false,
  });
});

test('a fresh demo exposes a navigable project and a complete sample Walkthrough', async () => {
  const send = createDemoTransport();
  const inventoryResponse = await send('/api/inventory');
  expect(inventoryResponse.status).toBe(200);
  const inventory = Schema.decodeUnknownSync(readInventoryResponseSchema)(
    await inventoryResponse.json(),
  );
  expect(inventory.projects[0]?.name).toBe('Hello Garden');
  const response = await send(`${worktree}/walkthrough`);
  const walkthrough = Schema.decodeUnknownSync(readWalkthroughResponseSchema)(
    await response.json(),
  );
  expect(walkthrough.walkthrough?.state.status).toBe('ready');
  expect(walkthrough.walkthrough?.state).toMatchObject({
    content: { title: 'A warmer welcome for every visitor' },
  });
});

test('sample source is readable and file mutations require a real computer', async () => {
  const send = createDemoTransport();
  const response = await send(`${worktree}/text?path=README.md`);
  expect(response.status).toBe(200);
  const file = Schema.decodeUnknownSync(readTextFileResponseSchema)(
    await response.json(),
  );
  expect(file.text).toContain('# Hello Garden');
  const refused = await send(
    `${worktree}/files`,
    request('POST', {
      kind: 'write',
      path: 'README.md',
      text: 'Replace the sample',
      expectedFingerprint: file.contentFingerprint,
    }),
  );
  expect(refused.status).toBe(422);
  const after = Schema.decodeUnknownSync(readTextFileResponseSchema)(
    await (await send(`${worktree}/text?path=README.md`)).json(),
  );
  expect(after.text).toBe(file.text);
});

test('reviewed marks can be set and removed without changing another demo session', async () => {
  const send = createDemoTransport();
  const changes = await readDemoChanges(send);
  const fingerprint = changes.changes[0]?.fingerprint;
  const response = await send(
    `${worktree}/reviewed`,
    request('PUT', { path: 'src/welcome.ts', reviewed: true, fingerprint }),
  );
  expect(response.status).toBe(200);
  const marked = Schema.decodeUnknownSync(listReviewedFilesResponseSchema)(
    await response.json(),
  );
  expect(marked.marks.map((mark) => mark.path)).toEqual(['src/welcome.ts']);
  const unmarked = Schema.decodeUnknownSync(listReviewedFilesResponseSchema)(
    await (
      await send(`${worktree}/reviewed?path=src%2Fwelcome.ts`, {
        method: 'DELETE',
      })
    ).json(),
  );
  expect(unmarked.marks).toEqual([]);
  await send(
    `${worktree}/reviewed`,
    request('PUT', {
      path: 'src/welcome.ts',
      reviewed: true,
      fingerprint,
      scope: 'branch',
      base: 'refs/heads/main',
    }),
  );
  const worktreeMarks = Schema.decodeUnknownSync(
    listReviewedFilesResponseSchema,
  )(await (await send(`${worktree}/reviewed`)).json());
  expect(worktreeMarks.marks).toEqual([]);
  const fresh = createDemoTransport();
  expect(
    Schema.decodeUnknownSync(listReviewedFilesResponseSchema)(
      await (await fresh(`${worktree}/reviewed`)).json(),
    ).marks,
  ).toEqual([]);
});

test('questions get explicitly simulated replies and no unsupported action pretends to succeed', async () => {
  const send = createDemoTransport();
  const response = await send(
    `${worktree}/walkthrough/demo-welcome/conversations/messages`,
    request('POST', {
      anchor: { kind: 'walkthrough' },
      text: 'Why trim the name?',
    }),
  );
  expect(response.status).toBe(200);
  const view = Schema.decodeUnknownSync(walkthroughConversationsResponseSchema)(
    await response.json(),
  );
  const messages = view.conversations[0]?.messages ?? [];
  expect(messages[0]).toMatchObject({
    author: 'developer',
    text: 'Why trim the name?',
  });
  const replies = messages.flatMap((message) =>
    message.author === 'agent' && message.state.status === 'answered'
      ? [message.state.text]
      : [],
  );
  expect(replies).toHaveLength(1);
  expect(replies[0]).toContain('Simulated demo reply');
  expect((await send('https://another.example/api/inventory')).status).toBe(
    404,
  );
  expect(
    (await send('/api/worktrees/not-the-demo/text?path=README.md')).status,
  ).toBe(404);
  const unsupported = await send(`${worktree}/git/push`, request('POST', {}));
  expect(unsupported.status).toBe(422);
  const failure = Schema.decodeUnknownSync(
    Schema.Struct({ message: Schema.String }),
  )(await unsupported.json());
  expect(failure.message).toContain('demo');
});

test('the sample file timeline opens a diff for that file', async () => {
  const send = createDemoTransport();
  const timeline = Schema.decodeUnknownSync(listFileCommitsResponseSchema)(
    await (await send(`${worktree}/file-commits?path=README.md`)).json(),
  );
  const oid = timeline.commits[0]?.commit.oid;
  const response = await send(
    `${worktree}/commits/${oid}/diffs`,
    request('POST', { paths: [['README.md']] }),
  );
  const answer = Schema.decodeUnknownSync(readCommitDiffsResponseSchema)(
    await response.json(),
  );
  expect(answer.diffs[0]?.paths).toEqual(['README.md']);
  expect(answer.diffs[0]?.content).toMatchObject({ kind: 'text' });
  const patches = answer.diffs.flatMap((diff) =>
    diff.content.kind === 'text' ? [diff.content.patch] : [],
  );
  expect(patches[0]).toContain('+# Hello Garden');
  expect(patches[0]).not.toContain('name.trim()');
});

test('branch marks survive a read and single or bulk removal uses the head branch', async () => {
  const send = createDemoTransport();
  const changes = await readDemoChanges(send);
  const fingerprint = changes.changes[0]?.fingerprint;
  const branchQuery =
    'scope=branch&branch=refs%2Fheads%2Ffeat%2Fwelcome-message';
  const read = async () =>
    Schema.decodeUnknownSync(listReviewedFilesResponseSchema)(
      await (await send(`${worktree}/reviewed?${branchQuery}`)).json(),
    );
  await send(
    `${worktree}/reviewed`,
    request('PUT', {
      scope: 'branch',
      base: 'refs/heads/main',
      path: 'src/welcome.ts',
      reviewed: true,
      fingerprint,
    }),
  );
  expect((await read()).marks.map((mark) => mark.path)).toEqual([
    'src/welcome.ts',
  ]);
  await send(`${worktree}/reviewed?${branchQuery}&path=src%2Fwelcome.ts`, {
    method: 'DELETE',
  });
  expect((await read()).marks).toEqual([]);
  await send(
    `${worktree}/reviewed-bulk`,
    request('PUT', {
      scope: 'branch',
      base: 'refs/heads/main',
      files: [
        { path: 'src/welcome.ts', fingerprint },
        { path: 'src/welcome.test.ts', fingerprint },
      ],
    }),
  );
  expect((await read()).marks.map((mark) => mark.path)).toEqual([
    'src/welcome.ts',
    'src/welcome.test.ts',
  ]);
  await send(
    `${worktree}/reviewed-bulk`,
    request('DELETE', {
      scope: 'branch',
      branch: 'refs/heads/feat/welcome-message',
      paths: ['src/welcome.ts'],
    }),
  );
  expect((await read()).marks.map((mark) => mark.path)).toEqual([
    'src/welcome.test.ts',
  ]);
  await send(
    `${worktree}/reviewed-bulk`,
    request('DELETE', {
      scope: 'branch',
      branch: 'refs/heads/feat/welcome-message',
      paths: ['src/welcome.test.ts'],
    }),
  );
  expect((await read()).marks).toEqual([]);
});

test('the sample branch comparison loads through the shared client using its advertised base', async () => {
  const { connection, close } = createWorktreeConnection(
    {
      environmentId: '83d90de8-793b-4f8c-ae11-b091581c9537',
      timeoutMs: 10_000,
      transport: createDemoTransport(),
    },
    undefined,
    Layer.empty,
  );
  const { registry } = scheduledRegistry();
  const selection = {
    connection,
    scope: {
      projectId: 'f5dd81bf-c039-4345-927a-e55315a50029',
      worktreeId: '9e939510f914ca5886ccab463c94166f',
    },
  };
  try {
    const bases = await Effect.runPromise(
      AtomRegistry.getResult(registry, readBranchBases(selection), {
        suspendOnWaiting: true,
      }),
    );
    const branch = await Effect.runPromise(
      AtomRegistry.getResult(
        registry,
        readBranchChanges({
          ...selection,
          ...(bases.defaultRef ? { base: bases.defaultRef } : {}),
        }),
        { suspendOnWaiting: true },
      ),
    );
    expect(branch.base?.ref).toBe('refs/heads/main');
    expect(branch.head.branch).toBe('refs/heads/feat/welcome-message');
    expect(branch.files.map((file) => file.path)).toEqual([
      'src/welcome.ts',
      'src/welcome.test.ts',
    ]);
  } finally {
    registry.dispose();
    await close();
  }
});

test('copied briefs contain only the chosen question or the saved questions', async () => {
  const send = createDemoTransport();
  const conversation = `${worktree}/walkthrough/demo-welcome/conversations`;
  const add = (text: string) =>
    send(
      `${conversation}/messages`,
      request('POST', { anchor: { kind: 'walkthrough' }, text }),
    );
  await add('First question');
  const view = Schema.decodeUnknownSync(walkthroughConversationsResponseSchema)(
    await (await add('Second question')).json(),
  );
  const messages = view.conversations.flatMap((entry) => entry.messages);
  const firstId = messages.find(
    (message) =>
      message.author === 'developer' && message.text === 'First question',
  )?.id;
  const secondId = messages.find(
    (message) =>
      message.author === 'developer' && message.text === 'Second question',
  )?.id;
  expect(firstId).toBeTypeOf('string');
  expect(secondId).toBeTypeOf('string');
  const brief = async (messageId?: string) => {
    const answer: unknown = await (
      await send(
        `${conversation}/brief${messageId ? `?messageId=${encodeURIComponent(messageId)}` : ''}`,
      )
    ).json();
    return answer;
  };
  expect(await brief(firstId)).toEqual({ text: 'First question' });
  expect(await brief(secondId)).toEqual({ text: 'Second question' });
  expect(await brief()).toEqual({ text: null });
  await send(
    `${conversation}/messages/${secondId}/saved`,
    request('PUT', { saved: true }),
  );
  expect(await brief()).toEqual({ text: 'Second question' });
  expect(await brief(firstId)).toEqual({ text: 'First question' });
  expect(await brief('missing-message')).toEqual({ text: null });
  await send(
    `${conversation}/messages/${firstId}/saved`,
    request('PUT', { saved: true }),
  );
  expect(await brief()).toEqual({ text: 'First question\n\nSecond question' });
  await send(
    `${conversation}/messages/${secondId}/saved`,
    request('PUT', { saved: false }),
  );
  expect(await brief()).toEqual({ text: 'First question' });
});
