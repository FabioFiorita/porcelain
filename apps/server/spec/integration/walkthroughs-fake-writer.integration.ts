import { expect } from 'vitest';
import { Schema } from 'effect';
import {
  readWalkthroughResponseSchema,
  walkthroughConversationsResponseSchema,
} from '@porcelain/contracts/walkthroughs';
import { test } from '../kit/server-test.ts';
import { read } from '../kit/requests.ts';
import { text } from '../kit/session.ts';

test('the verification fake answers the displayed ready walkthrough after a later writing attempt fails', async ({
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
  const runId = text(accepted.id);
  expect((await current()).walkthrough?.id).toBe(runId);
  expect((await current()).attempt).toBeUndefined();
  await session.writeFile(
    'notes.md',
    'Notes explain the sample and its follow-up.\n',
  );
  await session.git('add', 'notes.md');
  await session.git('commit', '-m', 'Expand sample notes');
  await session.writeFile('.git/porcelain-fake-walkthrough', 'signed-out');
  const update = await read(session, {
    method: 'POST',
    path,
    body: { base: 'refs/heads/fake-writer-base' },
  });
  await expect
    .poll(async () => (await current()).attempt?.state.status, {
      timeout: 10000,
    })
    .toBe('failed');
  const displayed = await current();
  expect(displayed.walkthrough?.id).toBe(runId);
  expect(displayed.attempt?.id).toBe(text(update.id));
  expect(displayed.outOfDate).toBe(true);
  await session.writeFile('.git/porcelain-fake-walkthrough', 'ready');
  const root = `${path}/${runId}/conversations`;
  const conversations = async () =>
    Schema.decodeUnknownSync(walkthroughConversationsResponseSchema)(
      await read(session, { method: 'GET', path: root }),
    );
  await read(session, {
    method: 'POST',
    path: `${root}/messages`,
    body: {
      anchor: { kind: 'walkthrough' },
      text: 'Why keep these notes?',
    },
  });
  const answer = async () =>
    (await conversations()).conversations[0]?.messages.find(
      (message) => message.author === 'agent',
    );
  await expect.poll(answer, { timeout: 10000 }).toMatchObject({
    author: 'agent',
    state: {
      status: 'answered',
      text: 'The notes explain why the sample changed; the glossary keeps its terms in one place.',
    },
  });
  const saved = await conversations();
  expect(await conversations()).toEqual(saved);
});
