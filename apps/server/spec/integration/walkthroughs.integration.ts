import { DatabaseSync } from 'node:sqlite';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  WalkthroughJob,
  WalkthroughRun,
} from '@porcelain/walkthroughs/models';
import { apiError } from '../kit/answers.ts';
import { handlerCoverage } from '../kit/route-coverage.ts';
import { expect } from 'vitest';
import { Schema } from 'effect';
import {
  readWalkthroughResponseSchema,
  walkthroughConversationsResponseSchema,
} from '@porcelain/contracts/walkthroughs';
import { test } from '../kit/server-test.ts';
import { read } from '../kit/requests.ts';
import { record, text } from '../kit/session.ts';

const WALKTHROUGH_ROUTES = [
  'GET /api/worktrees/:worktreeId/walkthrough',
  'GET /api/worktrees/:worktreeId/walkthrough/:runId/assets/:assetId',
  'GET /api/worktrees/:worktreeId/walkthrough/conversations',
  'GET /api/worktrees/:worktreeId/walkthrough/conversations/brief',
  'POST /api/worktrees/:worktreeId/walkthrough',
  'POST /api/worktrees/:worktreeId/walkthrough/conversations/messages',
  'POST /api/worktrees/:worktreeId/walkthrough/conversations/messages/:messageId/post',
  'POST /api/worktrees/:worktreeId/walkthrough/conversations/messages/:messageId/retry',
  'POST /api/worktrees/:worktreeId/walkthrough/conversations/post-saved',
  'PUT /api/worktrees/:worktreeId/walkthrough/conversations/messages/:messageId/saved',
].toSorted();

test('reads the latest attempt and reports when its pinned head is out of date', async ({
  session,
}) => {
  await session.git('branch', 'walkthrough-base');
  await session.writeFile('walkthrough.txt', 'A small committed change.\n');
  await session.git('add', 'walkthrough.txt');
  await session.git('commit', '-m', 'Add walkthrough fixture');
  const path = `/api/worktrees/${session.worktreeId}/walkthrough`;
  const first = await read(session, {
    method: 'POST',
    path,
    body: { base: 'refs/heads/walkthrough-base' },
  });
  const initial = Schema.decodeUnknownSync(readWalkthroughResponseSchema)(
    await read(session, { method: 'GET', path }),
  );
  expect(initial.outOfDate).toBe(false);
  expect(initial.walkthrough?.headOid).toBe(text(first.headOid));
  await session.writeFile('walkthrough.txt', 'The next committed change.\n');
  await session.git('add', 'walkthrough.txt');
  await session.git('commit', '-m', 'Advance the walkthrough head');
  const stale = Schema.decodeUnknownSync(readWalkthroughResponseSchema)(
    await read(session, { method: 'GET', path }),
  );
  expect(stale.outOfDate).toBe(true);
  expect(stale.walkthrough?.id).toBe(text(first.id));
  expect(stale.walkthrough?.headOid).toBe(text(first.headOid));
  const updated = await read(session, {
    method: 'POST',
    path,
    body: { base: 'refs/heads/walkthrough-base' },
  });
  expect(text(updated.id)).not.toBe(text(first.id));
  await session.git('reset', '--hard', text(first.headOid));
  const returned = Schema.decodeUnknownSync(readWalkthroughResponseSchema)(
    await read(session, { method: 'GET', path }),
  );
  expect(returned.outOfDate).toBe(true);
  expect(returned.walkthrough?.id).toBe(text(updated.id));
});

test('serves stored evidence bytes for a finished walkthrough and refuses assets outside the requested run', async ({
  session,
  server,
}) => {
  await session.writeFile('evidence-fixture.txt', 'First evidence state.\n');
  await session.git('add', 'evidence-fixture.txt');
  await session.git('commit', '-m', 'Prepare first evidence state');
  const firstHead = (await session.git('rev-parse', 'HEAD')).trim();
  await session.git('branch', 'walkthrough-evidence-base');
  await session.writeFile('evidence-fixture.txt', 'Second evidence state.\n');
  await session.git('add', 'evidence-fixture.txt');
  await session.git('commit', '-m', 'Prepare second evidence state');
  const secondHead = (await session.git('rev-parse', 'HEAD')).trim();
  const firstId = 'finished-evidence-one';
  const secondId = 'finished-evidence-two';
  const bytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=',
    'base64',
  );
  const run: WalkthroughRun = {
    id: firstId,
    projectId: session.projectId,
    worktreeId: session.worktreeId,
    baseOid: firstHead,
    headOid: firstHead,
    writer: { provider: 'claude', model: 'fixture' },
    createdAt: '2026-11-09T00:00:00.000Z',
    state: {
      status: 'ready',
      writtenAt: '2026-11-09T00:00:00.000Z',
      durationMs: 1,
      content: {
        outcome: 'nothing',
        title: 'Finished evidence fixture',
        summary: 'A completed walkthrough.',
        growth: [],
        stops: [],
        onlyInTranscript: [],
        stillUnclear: [],
      },
    },
  };
  const job: WalkthroughJob = {
    run,
    worktreePath: session.repository,
    files: [],
  };
  const other: WalkthroughJob = {
    ...job,
    run: { ...run, id: secondId, headOid: secondHead },
  };
  const database = new DatabaseSync(
    join(
      session.projectHome,
      session.fixture.folders.state,
      'inventory.sqlite',
    ),
  );
  try {
    database.exec('PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE');
    const insert = database.prepare(
      'INSERT INTO walkthrough_runs (id, worktree_id, head_oid, status, payload) VALUES (?, ?, ?, ?, ?)',
    );
    insert.run(
      firstId,
      session.worktreeId,
      firstHead,
      'ready',
      JSON.stringify(job),
    );
    insert.run(
      secondId,
      session.worktreeId,
      secondHead,
      'ready',
      JSON.stringify(other),
    );
    database
      .prepare(
        'INSERT INTO walkthrough_evidence (run_id, asset_id, media_type, caption, bytes) VALUES (?, ?, ?, ?, ?)',
      )
      .run(firstId, 'first-image', 'image/png', 'Existing screenshot', bytes);
    database.exec('COMMIT');
  } finally {
    database.close();
  }
  const path = `/api/worktrees/${session.worktreeId}/walkthrough`;
  const accepted = await read(session, {
    method: 'POST',
    path,
    body: { base: 'refs/heads/walkthrough-evidence-base' },
  });
  expect(accepted.id).toBe(secondId);
  const finished = Schema.decodeUnknownSync(readWalkthroughResponseSchema)(
    await read(session, { method: 'GET', path }),
  );
  expect(finished.walkthrough?.state.status).toBe('ready');
  expect(finished.walkthrough?.id).toBe(secondId);
  const response = await fetch(
    `${session.address}${path}/${firstId}/assets/first-image`,
    {
      headers: {
        authorization: `Bearer ${server.credential}`,
        origin: session.address,
      },
    },
  );
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('image/png');
  expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
  const elsewhere = await session.send({
    method: 'GET',
    path: `${path}/${secondId}/assets/first-image`,
  });
  expect(elsewhere.status).toBe(404);
  expect(elsewhere.headers['content-type']).toContain('application/json');
  expect(elsewhere.body).toEqual(
    apiError(404, 'Not Found', 'Walkthrough evidence asset not found'),
  );
  const missing = await session.send({
    method: 'GET',
    path: `${path}/${firstId}/assets/missing-image`,
  });
  expect(missing.status).toBe(404);
  expect(missing.body).toEqual(
    apiError(404, 'Not Found', 'Walkthrough evidence asset not found'),
  );
  const registered = server.routes.filter(
    (route) =>
      route.includes('/walkthrough') && !route.includes('/conversations'),
  );
  const requested = await server.requestedRoutes();
  expect(() =>
    handlerCoverage([
      { registered, requested, registeredTools: [], invokedTools: [] },
    ]),
  ).not.toThrow();
});

test('answers a walkthrough comment, keeps it after a refresh, copies a brief without a pull request and posts once with one', async ({
  session,
  server,
}) => {
  const manifest = record(
    JSON.parse(await readFile(server.manifestPath, 'utf8')),
  );
  const bin = text(manifest.bin);
  const ghCalls = join(session.projectHome, 'gh-comment-calls');
  const agentFails = join(session.projectHome, 'agent-fails');
  await writeFile(join(session.projectHome, 'gh-comment-calls'), '');
  await writeFile(
    join(bin, 'claude'),
    `#!${process.execPath}
import fs from 'node:fs';
const args = process.argv.slice(2);
fs.readFileSync(0, 'utf8');
if (fs.existsSync(${JSON.stringify(agentFails)})) { console.error('The tool crashed.'); process.exit(1); }
console.log(JSON.stringify({ session_id: args[args.indexOf('--resume') + 1] ?? 'fresh', total_cost_usd: 0.03, result: 'It keeps the retry local.' }));
`,
    { mode: 0o755 },
  );
  await writeFile(
    join(bin, 'gh'),
    `#!${process.execPath}
import fs from 'node:fs';
const args = process.argv.slice(2);
if (args[0] === 'auth' && args[1] === 'status') console.log(JSON.stringify(['fixture']));
else if (args[0] === 'auth' && args[1] === 'token') console.log('fixture-token');
else if (args.some((arg) => arg.endsWith('/issues/423/comments'))) {
  fs.appendFileSync(${JSON.stringify(ghCalls)}, fs.readFileSync(0, 'utf8') + '\\n');
  console.log(JSON.stringify({ html_url: 'https://github.com/FabioFiorita/porcelain/pull/423#issuecomment-1' }));
} else console.log('{}');
`,
    { mode: 0o755 },
  );
  await session.git(
    'remote',
    'add',
    'origin',
    'https://github.com/FabioFiorita/porcelain.git',
  );
  await session.writeFile('conversation-base.txt', 'Conversation base.\n');
  await session.git('add', 'conversation-base.txt');
  await session.git('commit', '-m', 'Prepare conversation fixture');
  const headA = (await session.git('rev-parse', 'HEAD')).trim();
  const worktreeRoot = `/api/worktrees/${session.worktreeId}/walkthrough/conversations`;
  const stop = (title: string, path: string) => ({
    title,
    explanation: 'Why it changed.',
    excerpts: [],
    evidence: [],
    files: [{ path, note: 'Owns the behavior' }],
  });
  const runJob = (
    id: string,
    head: string,
    stops: readonly ReturnType<typeof stop>[],
    pullRequestNumber: number | undefined,
  ): WalkthroughJob => ({
    run: {
      id,
      projectId: session.projectId,
      worktreeId: session.worktreeId,
      pullRequestNumber,
      pullRequestRepository:
        pullRequestNumber === undefined
          ? undefined
          : { owner: 'FabioFiorita', repo: 'porcelain' },
      baseOid: head,
      headOid: head,
      writer: { provider: 'claude', model: 'fixture' },
      sessionId: 'writer-session',
      createdAt: '2026-11-09T00:00:00.000Z',
      state: {
        status: 'ready',
        writtenAt: '2026-11-09T00:00:00.000Z',
        durationMs: 1,
        content: {
          outcome: 'worth_knowing',
          title: 'Conversation fixture',
          summary: 'A finished walkthrough.',
          growth: [],
          stops: [...stops],
          onlyInTranscript: [],
          stillUnclear: [],
        },
      },
    },
    worktreePath: session.repository,
    files: [],
  });
  const seed = (job: WalkthroughJob) => {
    const database = new DatabaseSync(
      join(
        session.projectHome,
        session.fixture.folders.state,
        'inventory.sqlite',
      ),
    );
    try {
      database.exec('PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE');
      database
        .prepare(
          'INSERT INTO walkthrough_runs (id, worktree_id, head_oid, status, payload) VALUES (?, ?, ?, ?, ?)',
        )
        .run(
          job.run.id,
          session.worktreeId,
          job.run.headOid,
          'ready',
          JSON.stringify(job),
        );
      database.exec('COMMIT');
    } finally {
      database.close();
    }
  };
  seed(
    runJob(
      'first-run',
      headA,
      [
        stop('Kept step', 'src/kept.ts'),
        stop('Removed step', 'src/removed.ts'),
      ],
      undefined,
    ),
  );
  const conversations = async () =>
    Schema.decodeUnknownSync(walkthroughConversationsResponseSchema)(
      await read(session, { method: 'GET', path: worktreeRoot }),
    );
  const agentState = async (id: string) => {
    const view = await conversations();
    for (const conversation of view.conversations)
      for (const message of conversation.messages)
        if (message.author === 'agent' && message.replyTo === id)
          return message.state.status;
    return undefined;
  };
  expect(await conversations()).toEqual({
    runId: 'first-run',
    pullRequestNumber: undefined,
    conversations: [],
  });
  const add = async (title: string | undefined, body: string) => {
    const answer = Schema.decodeUnknownSync(
      walkthroughConversationsResponseSchema,
    )(
      await read(session, {
        method: 'POST',
        path: `${worktreeRoot}/messages`,
        body: {
          runId: 'first-run',
          anchor:
            title === undefined
              ? { kind: 'walkthrough' }
              : { kind: 'stop', title },
          text: body,
        },
      }),
    );
    const last = answer.conversations.at(-1)?.messages.at(-2);
    return text(last?.id);
  };
  const kept = await add('Kept step', 'Why here?');
  await expect
    .poll(() => agentState(kept), { timeout: 10000 })
    .toBe('answered');
  const view = await conversations();
  const reply = view.conversations[0]?.messages[1];
  expect(reply).toMatchObject({
    author: 'agent',
    replyTo: kept,
    state: {
      status: 'answered',
      text: 'It keeps the retry local.',
      costUsd: 0.03,
    },
  });
  expect(await conversations()).toEqual(view);
  const missing = await session.send({
    method: 'PUT',
    path: `${worktreeRoot}/messages/nope/saved`,
    body: { saved: true },
  });
  expect(missing.status).toBe(404);
  expect(missing.body).toEqual(
    apiError(404, 'Not Found', 'Walkthrough message not found'),
  );
  const unknownStop = await session.send({
    method: 'POST',
    path: `${worktreeRoot}/messages`,
    body: {
      runId: 'first-run',
      anchor: { kind: 'stop', title: 'No such step' },
      text: 'Why?',
    },
  });
  expect(unknownStop.status).toBe(404);
  await read(session, {
    method: 'PUT',
    path: `${worktreeRoot}/messages/${kept}/saved`,
    body: { saved: true },
  });
  const brief = await read(session, {
    method: 'GET',
    path: `${worktreeRoot}/brief?messageId=${kept}`,
  });
  expect(brief.text).toBe(
    "From the walkthrough of this change:\n\n> Why here?\n\n**Step:** Kept step (`src/kept.ts`)\n**Agent's answer:** It keeps the retry local.\n",
  );
  const noPull = await read(session, {
    method: 'POST',
    path: `${worktreeRoot}/post-saved`,
  });
  expect(noPull.outcome).toEqual({ status: 'brief', text: brief.text });
  await writeFile(agentFails, '');
  const removed = await add('Removed step', 'Should this stay?');
  await expect
    .poll(() => agentState(removed), { timeout: 10000 })
    .toBe('failed');
  await rm(agentFails);
  await read(session, {
    method: 'POST',
    path: `${worktreeRoot}/messages/${removed}/retry`,
  });
  await expect
    .poll(() => agentState(removed), { timeout: 10000 })
    .toBe('answered');
  await session.writeFile('conversation.txt', 'Advance.\n');
  await session.git('add', 'conversation.txt');
  await session.git('commit', '-m', 'Advance the head');
  const headB = (await session.git('rev-parse', 'HEAD')).trim();
  seed(runJob('second-run', headB, [stop('Kept step', 'src/kept.ts')], 423));
  const refreshed = await conversations();
  expect(refreshed.runId).toBe('second-run');
  expect(refreshed.pullRequestNumber).toBe(423);
  expect(
    refreshed.conversations.map((conversation) => [
      conversation.runId,
      conversation.anchor,
    ]),
  ).toEqual([
    ['first-run', { kind: 'stop', title: 'Kept step' }],
    ['first-run', { kind: 'walkthrough' }],
  ]);
  const first = await read(session, {
    method: 'POST',
    path: `${worktreeRoot}/messages/${removed}/post`,
  });
  const url =
    'https://github.com/FabioFiorita/porcelain/pull/423#issuecomment-1';
  expect(first.outcome).toEqual({ status: 'posted', url });
  const second = await read(session, {
    method: 'POST',
    path: `${worktreeRoot}/messages/${removed}/post`,
  });
  expect(second.outcome).toEqual(first.outcome);
  const saved = await read(session, {
    method: 'POST',
    path: `${worktreeRoot}/post-saved`,
  });
  expect(saved.outcome).toEqual({ status: 'posted', url });
  const calls = (await readFile(ghCalls, 'utf8'))
    .trim()
    .split('\n')
    .filter(Boolean);
  expect(calls).toHaveLength(2);
  expect(calls[0]).toContain('"body":"From the walkthrough of this change:');
  const unposted = await add(undefined, 'A private decision');
  await expect
    .poll(() => agentState(unposted), { timeout: 10000 })
    .toBe('answered');
  await session.git(
    'remote',
    'set-url',
    'origin',
    'https://github.com/someone/public-fork.git',
  );
  const refused = await session.send({
    method: 'POST',
    path: `${worktreeRoot}/messages/${unposted}/post`,
  });
  expect(refused.status).toBe(409);
  expect(refused.body).toEqual(
    apiError(
      409,
      'Conflict',
      "This walkthrough's pull request is on FabioFiorita/porcelain, but this project's origin no longer points there. Nothing was posted. Copy the brief instead.",
    ),
  );
  expect(
    (await readFile(ghCalls, 'utf8')).trim().split('\n').filter(Boolean),
  ).toHaveLength(2);
  const offered = await read(session, {
    method: 'GET',
    path: `${worktreeRoot}/brief?messageId=${unposted}`,
  });
  expect(offered.text).toContain('A private decision');
  await session.git('branch', 'conversation-start-base');
  await session.writeFile('conversation.txt', 'Advance again.\n');
  await session.git('add', 'conversation.txt');
  await session.git('commit', '-m', 'Advance for a pull request start');
  const startedWithPull = await read(session, {
    method: 'POST',
    path: `/api/worktrees/${session.worktreeId}/walkthrough`,
    body: { base: 'refs/heads/conversation-start-base', pullRequestNumber: 41 },
  });
  expect(startedWithPull.pullRequestRepository).toEqual({
    owner: 'someone',
    repo: 'public-fork',
  });
  expect(
    server.routes.filter((route) => route.includes('/walkthrough')).toSorted(),
  ).toEqual(WALKTHROUGH_ROUTES);
  const registered = server.routes.filter((route) =>
    route.includes('/conversations'),
  );
  const requested = await server.requestedRoutes();
  expect(() =>
    handlerCoverage([
      { registered, requested, registeredTools: [], invokedTools: [] },
    ]),
  ).not.toThrow();
});
