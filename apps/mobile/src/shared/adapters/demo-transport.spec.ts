import { expect, test } from 'vitest';
import { Schema } from 'effect';
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
  const changes = Schema.decodeUnknownSync(readChangesResponseSchema)(
    await (await send(`${worktree}/changes`)).json(),
  );
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
      base: 'main',
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
