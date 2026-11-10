import { expect } from 'vitest';
import { Schema } from 'effect';
import {
  readWalkthroughResponseSchema,
  walkthroughConversationsResponseSchema,
} from '@porcelain/contracts/walkthroughs';
import { test } from '../kit/server-test.ts';
import { read } from '../kit/requests.ts';
import { text } from '../kit/session.ts';

test('the verification fake writes a walkthrough and answers its comment with retained plain text', async ({
  session,
}) => {
  await session.installCodingTool();
  await session.git('branch', 'fake-writer-base');
  await session.writeFile('notes.md', 'Notes explain the sample.\n');
  await session.git('add', 'notes.md');
  await session.git('commit', '-m', 'Add sample notes');
  const path = `/api/worktrees/${session.worktreeId}/walkthrough`;
  const accepted = await read(session, {
    method: 'POST',
    path,
    body: { base: 'refs/heads/fake-writer-base' },
  });
  const current = async () =>
    Schema.decodeUnknownSync(readWalkthroughResponseSchema)(
      await read(session, { method: 'GET', path }),
    );
  await expect
    .poll(async () => (await current()).walkthrough?.state.status, {
      timeout: 10000,
    })
    .toBe('ready');
  const conversations = async () =>
    Schema.decodeUnknownSync(walkthroughConversationsResponseSchema)(
      await read(session, { method: 'GET', path: `${path}/conversations` }),
    );
  await read(session, {
    method: 'POST',
    path: `${path}/conversations/messages`,
    body: {
      runId: text(accepted.id),
      anchor: { kind: 'walkthrough' },
      text: 'Why keep these notes?',
    },
  });
  const answer = async () =>
    (await conversations()).conversations[0]?.messages.find(
      (message) => message.author === 'agent',
    );
  await expect
    .poll(async () => (await answer())?.state.status, { timeout: 10000 })
    .not.toBe('answering');
  expect(await answer()).toMatchObject({
    author: 'agent',
    state: {
      status: 'answered',
      text: 'The notes explain why the sample changed; the glossary keeps its terms in one place.',
    },
  });
  const saved = await conversations();
  expect(await conversations()).toEqual(saved);
});
