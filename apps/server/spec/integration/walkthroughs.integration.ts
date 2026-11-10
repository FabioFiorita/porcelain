import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import type {
  WalkthroughJob,
  WalkthroughRun,
} from '@porcelain/walkthroughs/models';
import { apiError } from '../kit/answers.ts';
import { handlerCoverage } from '../kit/route-coverage.ts';
import { expect } from 'vitest';
import { Schema } from 'effect';
import { readWalkthroughResponseSchema } from '@porcelain/contracts/walkthroughs';
import { test } from '../kit/server-test.ts';
import { read } from '../kit/requests.ts';
import { text, list, record } from '../kit/session.ts';

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
  Object.assign(run, { branch: session.fixture.branch });
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
      !route.includes('/walkthrough-settings'),
  );
  expect(registered.toSorted()).toEqual([
    'GET /api/worktrees/:worktreeId/walkthrough',
    'GET /api/worktrees/:worktreeId/walkthrough/:runId/assets/:assetId',
    'POST /api/worktrees/:worktreeId/walkthrough',
  ]);
  const requested = await server.requestedRoutes();
  expect(() =>
    handlerCoverage([
      { registered, requested, registeredTools: [], invokedTools: [] },
    ]),
  ).not.toThrow();
});
