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

test('uncommitted content reaches ready, survives an identical commit and becomes stale only when content or base changes', async ({
  session,
}) => {
  await session.installCodingTool();
  await session.git('branch', 'working-base');
  await session.writeFile('notes.md', 'first line\nsecond line\n');
  const path = `/api/worktrees/${session.worktreeId}/walkthrough`;
  const start = () =>
    read(session, {
      method: 'POST',
      path,
      body: { base: 'refs/heads/working-base' },
    });
  const current = async () =>
    Schema.decodeUnknownSync(readWalkthroughResponseSchema)(
      await read(session, { method: 'GET', path }),
    );
  const accepted = await start();
  await expect
    .poll(
      async () => {
        const read = await current();
        return read.walkthrough?.id === accepted.id
          ? read.walkthrough?.state.status
          : undefined;
      },
      {
        timeout: 10000,
      },
    )
    .toBe('ready');
  expect((await current()).outOfDate).toBe(false);
  expect((await current()).walkthrough?.includesUncommitted).toBe(true);
  await session.git('add', '--all');
  await session.git('commit', '-m', 'Commit explained content');
  expect((await current()).outOfDate).toBe(false);
  expect((await start()).id).toBe(accepted.id);
  await session.writeFile('notes.md', 'first line\nsecond line\nnew edit\n');
  expect((await current()).outOfDate).toBe(true);
  const changed = await start();
  expect(changed.id).not.toBe(accepted.id);
  await expect
    .poll(async () => (await current()).walkthrough?.id, { timeout: 10000 })
    .toBe(changed.id);
  await session.git('branch', '-f', 'working-base', 'HEAD');
  expect((await current()).outOfDate).toBe(true);
});

test('edits during writing do not change the captured files or excerpt validation', async ({
  session,
}) => {
  await session.installCodingTool();
  await session.git('branch', 'capture-base');
  await session.writeFile('notes.md', 'captured for this run\nsecond line\n');
  await session.writeFile('.git/porcelain-fake-walkthrough', 'hold');
  const path = `/api/worktrees/${session.worktreeId}/walkthrough`;
  const accepted = await read(session, {
    method: 'POST',
    path,
    body: { base: 'refs/heads/capture-base' },
  });
  const current = async () =>
    Schema.decodeUnknownSync(readWalkthroughResponseSchema)(
      await read(session, { method: 'GET', path }),
    );
  await expect
    .poll(
      async () =>
        (await current()).attempt?.state.status ??
        (await current()).walkthrough?.state.status,
      {
        timeout: 10000,
      },
    )
    .toBe('running');
  await session.writeFile('notes.md', 'changed while writing\n');
  await session.writeFile('later.md', 'not captured\n');
  await session.writeFile('.git/porcelain-fake-walkthrough', 'ready');
  await expect
    .poll(async () => (await current()).walkthrough?.state.status, {
      timeout: 10000,
    })
    .toBe('ready');
  await expect
    .poll(async () => (await current()).walkthrough?.id, { timeout: 10000 })
    .toBe(accepted.id);
  expect((await current()).outOfDate).toBe(true);
});

test('an unsupported untracked Git filter preserves the saved walkthrough and explains a refused update', async ({
  session,
}) => {
  await session.installCodingTool();
  await session.git('branch', 'filter-base');
  const path = `/api/worktrees/${session.worktreeId}/walkthrough`;
  const accepted = await read(session, {
    method: 'POST',
    path,
    body: { base: 'refs/heads/filter-base' },
  });
  const current = async () =>
    Schema.decodeUnknownSync(readWalkthroughResponseSchema)(
      await read(session, { method: 'GET', path }),
    );
  await expect
    .poll(
      async () => {
        const view = await current();
        return view.walkthrough?.id === accepted.id
          ? view.walkthrough?.state.status
          : undefined;
      },
      { timeout: 10000 },
    )
    .toBe('ready');
  const saved = (await current()).walkthrough;
  await session.writeFile('.gitattributes', '*.secret filter=example\n');
  await session.writeFile('new.secret', 'keep this untracked\n');
  expect((await current()).walkthrough).toEqual(saved);
  expect((await current()).walkthrough?.id).toBe(accepted.id);
  expect((await current()).outOfDate).toBe(true);
  const refused = await read(
    session,
    {
      method: 'POST',
      path,
      body: { base: 'refs/heads/filter-base' },
    },
    422,
  );
  expect(refused.message).toBe(
    'This change uses Git conversion filters, which Porcelain will not execute.',
  );
});
