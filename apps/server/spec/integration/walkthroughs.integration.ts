import {
  scriptedWalkthroughs,
  seedStoredWalkthroughs,
} from '../kit/walkthrough-fixture.ts';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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
import { list, record, text } from '../kit/session.ts';

const WALKTHROUGH_ROUTES = [
  'GET /api/worktrees/:worktreeId/walkthrough',
  'GET /api/worktrees/:worktreeId/walkthrough/:runId/assets/:assetId',
  'GET /api/worktrees/:worktreeId/walkthrough/:runId/conversations',
  'GET /api/worktrees/:worktreeId/walkthrough/:runId/conversations/brief',
  'POST /api/worktrees/:worktreeId/walkthrough',
  'POST /api/worktrees/:worktreeId/walkthrough/:runId/conversations/messages',
  'POST /api/worktrees/:worktreeId/walkthrough/:runId/conversations/messages/:messageId/post',
  'POST /api/worktrees/:worktreeId/walkthrough/:runId/conversations/messages/:messageId/retry',
  'POST /api/worktrees/:worktreeId/walkthrough/:runId/conversations/post-saved',
  'PUT /api/worktrees/:worktreeId/walkthrough/:runId/conversations/messages/:messageId/saved',
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
  expect(initial.freshness).toBe('current');
  expect(initial.walkthrough?.state.status).not.toBe('ready');
  expect(initial.attempt).toBeUndefined();
  expect(initial.walkthrough?.headOid).toBe(text(first.headOid));
  await session.writeFile('walkthrough.txt', 'The next committed change.\n');
  await session.git('add', 'walkthrough.txt');
  await session.git('commit', '-m', 'Advance the walkthrough head');
  const stale = Schema.decodeUnknownSync(readWalkthroughResponseSchema)(
    await read(session, { method: 'GET', path }),
  );
  expect(stale.freshness).toBe('changed');
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
  expect(returned.freshness).toBe('changed');
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
    baseRef: 'refs/heads/walkthrough-evidence-base',
    contentTreeOid: (
      await session.git('rev-parse', `${firstHead}^{tree}`)
    ).trim(),
    includesUncommitted: false,
    headOid: firstHead,
    writer: { provider: 'claude', model: 'fixture', effort: 'high' },
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
  Object.assign(run, {
    branch: session.fixture.branch.replace(/^refs\/heads\//, ''),
  });
  const job: WalkthroughJob = {
    run,
    worktreePath: session.repository,
    patch: '',
    files: [],
  };
  const other: WalkthroughJob = {
    ...job,
    run: {
      ...run,
      id: secondId,
      headOid: secondHead,
      contentTreeOid: (
        await session.git('rev-parse', `${secondHead}^{tree}`)
      ).trim(),
    },
  };
  const directory = join(session.projectHome, session.fixture.folders.state);
  seedStoredWalkthroughs(directory, {
    jobs: [job, other],
    assets: [
      {
        runId: firstId,
        id: 'first-image',
        mediaType: 'image/png',
        caption: 'Existing screenshot',
        bytes,
      },
    ],
  });
  const readState = async () =>
    Schema.decodeUnknownSync(readWalkthroughResponseSchema)(
      await read(session, {
        method: 'GET',
        path: `/api/worktrees/${session.worktreeId}/walkthrough`,
      }),
    );
  const attempt: WalkthroughJob = {
    ...other,
    run: { ...other.run, id: 'new-attempt', state: { status: 'queued' } },
  };
  for (const state of [
    { status: 'queued' },
    { status: 'running' },
    { status: 'failed', failure: { kind: 'other', message: 'Writer failed' } },
  ] as const) {
    seedStoredWalkthroughs(directory, {
      jobs: [{ ...attempt, run: { ...attempt.run, state } }],
    });
    const retained = await readState();
    expect(retained.walkthrough?.id).toBe(secondId);
    expect(retained.attempt?.state).toEqual(state);
    expect(retained.freshness).toBe('current');
  }
  await session.git('commit', '--allow-empty', '-m', 'Advance during update');
  expect((await readState()).freshness).toBe('current');
  await session.git('reset', '--hard', secondHead);
  await session.git('switch', '-c', 'no-walkthrough');
  expect((await readState()).walkthrough).toBeUndefined();
  await session.git('switch', session.fixture.branch);
  await read(session, { method: 'POST', path: '/api/inventory/refresh' });
  seedStoredWalkthroughs(directory, { removeRuns: ['new-attempt'] });
  const path = `/api/worktrees/${session.worktreeId}/walkthrough`;
  const accepted = await read(session, {
    method: 'POST',
    path,
    body: { base: 'refs/heads/walkthrough-evidence-base', writer: run.writer },
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
  const title = (body: Record<string, unknown>) =>
    record(list(record(list(body.projects)[0]).worktrees)[0]).walkthroughTitle;
  expect(
    title(await read(session, { method: 'GET', path: '/api/inventory' })),
  ).toBe('Finished evidence fixture');
  await session.git('commit', '--allow-empty', '-m', 'Advance same branch');
  expect(
    title(await read(session, { method: 'GET', path: '/api/inventory' })),
  ).toBe('Finished evidence fixture');
  await session.git('switch', '-c', 'another-topic');
  expect(
    title(
      await read(session, { method: 'POST', path: '/api/inventory/refresh' }),
    ),
  ).toBeUndefined();
  const registered = server.routes.filter(
    (route) =>
      route.includes('/walkthrough') &&
      !route.includes('/conversations') &&
      !route.includes('/walkthrough-settings'),
  );
  const requested = await server.requestedRoutes();
  expect(() => handlerCoverage([{ registered, requested }])).not.toThrow();
});

test('answers a walkthrough comment, keeps it after a refresh, copies a brief without a pull request and posts once with one', async ({
  session,
  server,
}) => {
  const ghCalls = join(session.projectHome, 'gh-comment-calls');
  const agentFails = join(session.projectHome, 'agent-fails');
  const writer = await scriptedWalkthroughs(session, server.manifestPath, {
    answer: 'It keeps the retry local.',
    costUsd: 0.03,
    failurePath: agentFails,
    postsPath: ghCalls,
    argumentsPath: join(session.projectHome, 'answer-writer-args'),
  });
  await session.git(
    'remote',
    'add',
    'origin',
    'https://github.com/FabioFiorita/porcelain.git',
  );
  await session.git('branch', 'conversation-fixture-base');
  await mkdir(join(session.repository, 'src'));
  await session.writeFile('src/kept.ts', 'export const kept = true;\n');
  await session.writeFile('src/removed.ts', 'export const removed = true;\n');
  await session.git('add', 'src/kept.ts', 'src/removed.ts');
  await session.writeFile('conversation-base.txt', 'Conversation base.\n');
  await session.git('add', 'conversation-base.txt');
  await session.git('commit', '-m', 'Prepare conversation fixture');
  const headA = (await session.git('rev-parse', 'HEAD')).trim();
  let displayedRunId = '';
  const worktreeRoot = (runId = displayedRunId) =>
    `/api/worktrees/${session.worktreeId}/walkthrough/${runId}/conversations`;
  const stop = (title: string, path: string) => ({
    title,
    explanation: 'Why it changed.',
    excerpts: [],
    evidence: [],
    files: [{ path, note: 'Owns the behavior' }],
  });
  const currentBranch = (await session.git('branch', '--show-current')).trim();
  const runJob = (
    id: string,
    head: string,
    stops: readonly ReturnType<typeof stop>[],
    pullRequestNumber: number | undefined,
    branch = currentBranch,
  ): WalkthroughJob => ({
    run: {
      id,
      projectId: session.projectId,
      worktreeId: session.worktreeId,
      pullRequestNumber,
      branch,
      pullRequestRepository: { owner: 'FabioFiorita', repo: 'porcelain' },
      baseOid: head,
      baseRef: 'refs/heads/main',
      contentTreeOid: head,
      includesUncommitted: false,
      headOid: head,
      writer: { provider: 'claude', model: 'fixture', effort: 'high' },
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
    patch: '',
    files: [],
  });
  const seed = async (job: WalkthroughJob) => {
    if (job.run.pullRequestRepository === undefined) {
      seedStoredWalkthroughs(
        join(session.projectHome, session.fixture.folders.state),
        { jobs: [job] },
      );
      return job.run.id;
    }
    if (job.run.state.status !== 'ready')
      throw new Error('This fixture writes a finished walkthrough');
    return (
      await writer.write(job.run.state.content, {
        base: 'refs/heads/conversation-fixture-base',
        ...(job.run.pullRequestNumber === undefined
          ? {}
          : { pullRequestNumber: job.run.pullRequestNumber }),
      })
    ).id;
  };
  let firstRunId = 'first-run';
  let secondRunId = 'second-run';
  let branchBRunId = 'branch-b-run';
  const legacy = runJob('legacy-run', headA, [], undefined);
  await seed({
    ...legacy,
    run: { ...legacy.run, pullRequestRepository: undefined },
  });
  firstRunId = await seed(
    runJob(
      firstRunId,
      headA,
      [
        stop('Kept step', 'src/kept.ts'),
        stop('Removed step', 'src/removed.ts'),
      ],
      undefined,
    ),
  );
  displayedRunId = firstRunId;
  const conversations = async () =>
    Schema.decodeUnknownSync(walkthroughConversationsResponseSchema)(
      await read(session, { method: 'GET', path: worktreeRoot() }),
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
    runId: firstRunId,
    pullRequestNumber: undefined,
    conversations: [],
  });
  const add = async (
    title: string | undefined,
    body: string,
    runId = firstRunId,
    writer?: { provider: 'claude'; model: string; effort: 'xhigh' },
  ) => {
    const answer = Schema.decodeUnknownSync(
      walkthroughConversationsResponseSchema,
    )(
      await read(session, {
        method: 'POST',
        path: `${worktreeRoot(runId)}/messages`,
        body: {
          writer,
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
    path: `${worktreeRoot()}/messages/nope/saved`,
    body: { saved: true },
  });
  expect(missing.status).toBe(404);
  expect(missing.body).toEqual(
    apiError(404, 'Not Found', 'Walkthrough message not found'),
  );
  const unknownStop = await session.send({
    method: 'POST',
    path: `${worktreeRoot(firstRunId)}/messages`,
    body: {
      anchor: { kind: 'stop', title: 'No such step' },
      text: 'Why?',
    },
  });
  expect(unknownStop.status).toBe(404);
  await read(session, {
    method: 'PUT',
    path: `${worktreeRoot()}/messages/${kept}/saved`,
    body: { saved: true },
  });
  const brief = await read(session, {
    method: 'GET',
    path: `${worktreeRoot()}/brief?messageId=${kept}`,
  });
  expect(brief.text).toBe(
    "From the walkthrough of this change:\n\n> Why here?\n\n**Step:** Kept step (`src/kept.ts`)\n**Agent's answer:** It keeps the retry local.\n",
  );
  const noPull = await read(session, {
    method: 'POST',
    path: `${worktreeRoot()}/post-saved`,
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
    path: `${worktreeRoot()}/messages/${removed}/retry`,
  });
  await expect
    .poll(() => agentState(removed), { timeout: 10000 })
    .toBe('answered');
  await session.writeFile('conversation.txt', 'Advance.\n');
  await session.git('add', 'conversation.txt');
  await session.git('commit', '-m', 'Advance the head');
  const headB = (await session.git('rev-parse', 'HEAD')).trim();
  secondRunId = await seed(
    runJob(secondRunId, headB, [stop('Kept step', 'src/kept.ts')], 423),
  );
  displayedRunId = secondRunId;
  const refreshed = await conversations();
  expect(refreshed.runId).toBe(secondRunId);
  expect(refreshed.pullRequestNumber).toBe(423);
  expect(
    refreshed.conversations.map((conversation) => [
      conversation.runId,
      conversation.anchor,
    ]),
  ).toEqual([
    [firstRunId, { kind: 'stop', title: 'Kept step' }],
    [firstRunId, { kind: 'walkthrough' }],
  ]);
  const legacyMessage = await add(
    undefined,
    'A message without recorded origin',
    'legacy-run',
  );
  const missingRepository = await session.send({
    method: 'POST',
    path: `${worktreeRoot()}/messages/${legacyMessage}/post`,
  });
  expect(missingRepository.status).toBe(409);
  const unbound = await session.send({
    method: 'POST',
    path: `${worktreeRoot()}/messages/${removed}/post`,
  });
  expect(unbound.status).toBe(200);
  expect(record(unbound.body).outcome).toEqual({
    status: 'posted',
    url: 'https://github.com/FabioFiorita/porcelain/pull/423#issuecomment-1',
    notPosted: [],
  });
  const onPull = await add('Kept step', 'Ship it this way?', secondRunId, {
    provider: 'claude',
    model: 'sonnet',
    effort: 'xhigh',
  });
  await expect
    .poll(() => agentState(onPull), { timeout: 10000 })
    .toBe('answered');
  const answerArgs = list(
    JSON.parse(
      (await readFile(join(session.projectHome, 'answer-writer-args'), 'utf8'))
        .trim()
        .split('\n')
        .at(-1) ?? 'null',
    ),
  ).map(text);
  expect(answerArgs[answerArgs.indexOf('--model') + 1]).toBe('sonnet');
  expect(answerArgs[answerArgs.indexOf('--effort') + 1]).toBe('xhigh');
  expect(answerArgs).not.toContain('--resume');
  const first = await read(session, {
    method: 'POST',
    path: `${worktreeRoot()}/messages/${onPull}/post`,
  });
  const url =
    'https://github.com/FabioFiorita/porcelain/pull/423#issuecomment-1';
  expect(first.outcome).toEqual({ status: 'posted', url, notPosted: [] });
  const second = await read(session, {
    method: 'POST',
    path: `${worktreeRoot()}/messages/${onPull}/post`,
  });
  expect(second.outcome).toEqual(first.outcome);
  const savedOnPull = await add(undefined, 'Saved on the pull', secondRunId);
  await read(session, {
    method: 'PUT',
    path: `${worktreeRoot()}/messages/${savedOnPull}/saved`,
    body: { saved: true },
  });
  const saved = await read(session, {
    method: 'POST',
    path: `${worktreeRoot()}/post-saved`,
  });
  expect(saved.outcome).toEqual({ status: 'posted', url, notPosted: [] });
  const calls = (await readFile(ghCalls, 'utf8'))
    .trim()
    .split('\n')
    .filter(Boolean);
  expect(calls).toHaveLength(3);
  expect(calls[0]).toContain('"body":"From the walkthrough of this change:');
  const branchA = await add(
    undefined,
    'Only branch A should see this.',
    secondRunId,
  );
  await read(session, {
    method: 'PUT',
    path: `${worktreeRoot()}/messages/${branchA}/saved`,
    body: { saved: true },
  });
  await session.git('switch', '-c', 'conversation-branch-b');
  branchBRunId = await seed(
    runJob(
      branchBRunId,
      headB,
      [stop('Kept step', 'src/kept.ts')],
      424,
      'conversation-branch-b',
    ),
  );
  displayedRunId = branchBRunId;
  const branchB = await add(
    undefined,
    'Only branch B should see this.',
    branchBRunId,
  );
  await read(session, {
    method: 'PUT',
    path: `${worktreeRoot()}/messages/${branchB}/saved`,
    body: { saved: true },
  });
  await session.git('switch', currentBranch);
  displayedRunId = secondRunId;
  const branchRead = Schema.decodeUnknownSync(readWalkthroughResponseSchema)(
    await read(session, {
      method: 'GET',
      path: `/api/worktrees/${session.worktreeId}/walkthrough`,
    }),
  );
  expect(branchRead.walkthrough?.id).toBe(secondRunId);
  const onA = await conversations();
  expect(onA.runId).toBe(secondRunId);
  expect(onA.pullRequestNumber).toBe(423);
  expect(JSON.stringify(onA)).not.toContain('Only branch B');
  const pinnedB = await read(session, {
    method: 'GET',
    path: worktreeRoot(branchBRunId),
  });
  expect(pinnedB.runId).toBe(branchBRunId);
  const foreign = runJob('foreign-run', headB, [], 999);
  seedStoredWalkthroughs(
    join(session.projectHome, session.fixture.folders.state),
    {
      jobs: [
        { ...foreign, run: { ...foreign.run, worktreeId: 'f'.repeat(32) } },
      ],
    },
  );
  for (const request of [
    { method: 'GET', path: worktreeRoot('foreign-run') },
    {
      method: 'POST',
      path: `${worktreeRoot('foreign-run')}/messages`,
      body: { anchor: { kind: 'walkthrough' }, text: 'Foreign target' },
    },
    {
      method: 'PUT',
      path: `${worktreeRoot('foreign-run')}/messages/${branchA}/saved`,
      body: { saved: true },
    },
    {
      method: 'POST',
      path: `${worktreeRoot('foreign-run')}/messages/${branchA}/retry`,
    },
    {
      method: 'POST',
      path: `${worktreeRoot('foreign-run')}/messages/${branchA}/post`,
    },
    { method: 'POST', path: `${worktreeRoot('foreign-run')}/post-saved` },
    { method: 'GET', path: `${worktreeRoot('foreign-run')}/brief` },
  ] as const) {
    const refused = await session.send(request);
    expect(refused.status).toBe(404);
  }
  const branchBrief = await read(session, {
    method: 'GET',
    path: `${worktreeRoot()}/brief`,
  });
  expect(branchBrief.text).toContain('Only branch A');
  expect(branchBrief.text).not.toContain('Only branch B');
  const wrongBrief = await session.send({
    method: 'GET',
    path: `${worktreeRoot()}/brief?messageId=${branchB}`,
  });
  expect(wrongBrief.status).toBe(404);
  const wrongPost = await session.send({
    method: 'POST',
    path: `${worktreeRoot()}/messages/${branchB}/post`,
  });
  expect(wrongPost.status).toBe(404);
  for (const request of [
    {
      method: 'PUT',
      path: `${worktreeRoot()}/messages/${branchB}/saved`,
      body: { saved: false },
    },
    { method: 'POST', path: `${worktreeRoot()}/messages/${branchB}/retry` },
  ] as const) {
    const refused = await session.send(request);
    expect(refused.status).toBe(404);
  }
  const postedA = await read(session, {
    method: 'POST',
    path: `${worktreeRoot()}/post-saved`,
  });
  expect(record(postedA.outcome).url).toBe(
    'https://github.com/FabioFiorita/porcelain/pull/423#issuecomment-1',
  );
  expect(record(postedA.view).runId).toBe(secondRunId);
  await session.git('switch', 'conversation-branch-b');
  displayedRunId = branchBRunId;
  const postedB = await read(session, {
    method: 'POST',
    path: `${worktreeRoot()}/post-saved`,
  });
  expect(record(postedB.outcome).url).toBe(
    'https://github.com/FabioFiorita/porcelain/pull/424#issuecomment-1',
  );
  expect(record(postedB.view).runId).toBe(branchBRunId);
  await session.git('switch', currentBranch);
  displayedRunId = secondRunId;
  const unposted = await add(undefined, 'A private decision', secondRunId);
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
    path: `${worktreeRoot()}/messages/${unposted}/post`,
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
  ).toHaveLength(5);
  const offered = await read(session, {
    method: 'GET',
    path: `${worktreeRoot()}/brief?messageId=${unposted}`,
  });
  expect(offered.text).toContain('A private decision');
  await session.git('branch', 'conversation-start-base');
  await session.writeFile('conversation.txt', 'Advance again.\n');
  await session.git('add', 'conversation.txt');
  await session.git('commit', '-m', 'Advance for a pull request start');
  const startedWithPull = await read(session, {
    method: 'POST',
    path: `/api/worktrees/${session.worktreeId}/walkthrough`,
    body: { base: 'refs/heads/conversation-start-base' },
  });
  expect(startedWithPull.pullRequestRepository).toEqual({
    owner: 'someone',
    repo: 'public-fork',
  });
  expect(
    server.routes
      .filter(
        (route) =>
          route.includes('/walkthrough') &&
          !route.includes('/walkthrough-settings'),
      )
      .toSorted(),
  ).toEqual(WALKTHROUGH_ROUTES);
  const registered = server.routes.filter((route) =>
    route.includes('/conversations'),
  );
  const requested = await server.requestedRoutes();
  expect(() => handlerCoverage([{ registered, requested }])).not.toThrow();
});

test('announces screenshots attached to a ready walkthrough to a client that is already following it', async ({
  session,
  server,
}) => {
  const writer = await scriptedWalkthroughs(session, server.manifestPath, {
    answer: 'Unused.',
    costUsd: 0.01,
    failurePath: join(session.projectHome, 'evidence-writer-fails'),
    postsPath: join(session.projectHome, 'evidence-posts'),
  });
  await session.git('branch', 'evidence-live-base');
  await session.writeFile('evidence-live.txt', 'Shown in a screenshot.\n');
  await session.git('add', 'evidence-live.txt');
  await session.git('commit', '-m', 'Prepare live evidence fixture');
  const run = await writer.write(
    {
      outcome: 'worth_knowing',
      title: 'Live evidence',
      summary: 'A walkthrough that gains screenshots.',
      growth: [],
      stops: [
        {
          title: 'Shown step',
          explanation: 'Why it changed.',
          excerpts: [],
          evidence: [],
          files: [{ path: 'evidence-live.txt', note: 'Owns the behavior' }],
        },
      ],
      onlyInTranscript: [],
      stillUnclear: [],
    },
    { base: 'refs/heads/evidence-live-base' },
  );
  const client = await session.live();
  try {
    await client.follow({
      projects: [session.projectId],
      worktrees: [
        {
          projectId: session.projectId,
          worktreeId: session.worktreeId,
          paths: [],
        },
      ],
    });
    await client.next((notice) => notice.type === 'subscribed');
    const bytes = Uint8Array.from([137, 80, 78, 71]);
    await writer.attachEvidence(run.id, 1, [
      {
        id: 'live-screen',
        mediaType: 'image/png',
        caption: 'The live screen',
        bytes,
      },
    ]);
    await client.next(
      (notice) =>
        notice.type === 'worktree' &&
        notice.change === 'git' &&
        notice.worktreeId === session.worktreeId,
      5000,
    );
  } finally {
    await client.close();
  }
  const path = `/api/worktrees/${session.worktreeId}/walkthrough`;
  const shown = Schema.decodeUnknownSync(readWalkthroughResponseSchema)(
    await read(session, { method: 'GET', path }),
  );
  expect(
    shown.walkthrough?.state.status === 'ready'
      ? shown.walkthrough.state.content.stops[0]?.evidence
      : undefined,
  ).toEqual([{ assetId: 'live-screen', shows: 'The live screen' }]);
  const asset = await fetch(
    `${session.address}${path}/${run.id}/assets/live-screen`,
    {
      headers: {
        authorization: `Bearer ${server.credential}`,
        origin: session.address,
      },
    },
  );
  expect(Buffer.from(await asset.arrayBuffer())).toEqual(
    Buffer.from([137, 80, 78, 71]),
  );
});
