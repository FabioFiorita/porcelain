import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import {
  listCommitsResponseSchema,
  listFileCommitsResponseSchema,
  readChangeDiffsResponseSchema,
  readChangesResponseSchema,
  readGitStatusResponseSchema,
} from '@porcelain/contracts/changes';
import {
  listDirectoryResponseSchema,
  listWorktreePathsResponseSchema,
  readTextFileResponseSchema,
} from '@porcelain/contracts/files';
import {
  readInventoryResponseSchema,
  registerProjectResponseSchema,
} from '@porcelain/contracts/projects';
import {
  createCommentThreadResponseSchema,
  listCommentThreadsResponseSchema,
  listReviewedFilesResponseSchema,
  readPublishedReviewResponseSchema,
  removeReviewedFileResponseSchema,
  setReviewedFileResponseSchema,
} from '@porcelain/contracts/reviews';
import { expect } from 'vitest';
import {
  ROUTE_BUDGETS,
  ROUTE_BUDGET_REQUESTS,
} from '../../src/config/limits.ts';
import type { Recorder } from '../kit/isolated-server.ts';
import { changes } from '../kit/reads.ts';
import { read, sampleReview, worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import {
  list,
  record,
  type HttpRequest,
  type HttpResponse,
  type PerfSample,
  type Session,
} from '../kit/session.ts';

async function sendAll(session: Session, requests: readonly HttpRequest[]) {
  const responses: HttpResponse[] = [];
  for (const request of requests) responses.push(await session.send(request));
  return responses;
}

const repeated = (request: HttpRequest) =>
  Array.from({ length: ROUTE_BUDGET_REQUESTS }, () => request);

const answeredEach = Array.from({ length: ROUTE_BUDGET_REQUESTS }, () => 200);

function measured(recorder: Recorder, from: number) {
  const timed = recorder.steps
    .slice(from)
    .flatMap((step) =>
      step.kind === 'http' &&
      step.durationMs !== undefined &&
      step.git !== undefined
        ? [{ ms: step.durationMs, git: step.git.processes }]
        : [],
    );
  const times = timed.map((entry) => entry.ms).sort((a, b) => a - b);
  return {
    requests: timed.length,
    p95Ms: times[Math.max(0, Math.ceil(0.95 * times.length) - 1)] ?? 0,
    gitProcesses: Math.max(0, ...timed.map((entry) => entry.git)),
  };
}

function sampleOf(session: Session): PerfSample {
  if (session.fixture.perf === null)
    throw new Error('The route budgets run on the perf sample');
  return session.fixture.perf;
}

async function changedSources(session: Session) {
  const read = await changes(session);
  const sources = read.changes.flatMap((change) =>
    change.path.startsWith('src/module-') && change.fingerprint !== null
      ? [{ path: change.path, fingerprint: change.fingerprint }]
      : [],
  );
  if (sources.length < ROUTE_BUDGET_REQUESTS)
    throw new Error('The perf sample has too few changed source files');
  return { ...read, sources: sources.slice(0, ROUTE_BUDGET_REQUESTS) };
}

async function firstSource(session: Session) {
  const [source] = (await changedSources(session)).sources;
  if (!source) throw new Error('The perf sample has no changed source file');
  return source.path;
}

const parentOf = (path: string) => path.slice(0, path.lastIndexOf('/'));

test('registering every sample project stays within the register budget', async ({
  session,
  recorder,
}) => {
  const from = recorder.steps.length;
  const projects = sampleOf(session).projects;

  const responses = await sendAll(
    session,
    projects.map((project) => ({
      method: 'POST' as const,
      path: '/api/projects',
      body: { path: join(session.projectHome, project) },
    })),
  );

  expect(responses.map((response) => response.status)).toStrictEqual(
    projects.map(() => 200),
  );
  for (const response of responses)
    expect(response.body).toEqual(
      expect.schemaMatching(registerProjectResponseSchema),
    );
  const cost = measured(recorder, from);
  expect(cost.requests).toBe(projects.length);
  expect(cost.p95Ms, 'register a project: p95 ms').toBeLessThanOrEqual(
    ROUTE_BUDGETS.registerProject.p95Ms,
  );
  expect(
    cost.gitProcesses,
    'register a project: Git processes per request',
  ).toBeLessThanOrEqual(ROUTE_BUDGETS.registerProject.gitProcesses);
});

test('reading the inventory lists every project within its budget', async ({
  session,
  recorder,
}) => {
  const from = recorder.steps.length;

  const responses = await sendAll(
    session,
    repeated({ method: 'GET', path: '/api/inventory' }),
  );

  expect(responses.map((response) => response.status)).toStrictEqual(
    answeredEach,
  );
  for (const response of responses)
    expect(response.body).toEqual(
      expect.schemaMatching(readInventoryResponseSchema),
    );
  expect(
    responses.map((response) => list(record(response.body).projects).length),
  ).toStrictEqual(
    Array.from(
      { length: ROUTE_BUDGET_REQUESTS },
      () => sampleOf(session).projects.length + 1,
    ),
  );
  const cost = measured(recorder, from);
  expect(cost.requests).toBe(ROUTE_BUDGET_REQUESTS);
  expect(cost.p95Ms, 'read the inventory: p95 ms').toBeLessThanOrEqual(
    ROUTE_BUDGETS.readInventory.p95Ms,
  );
  expect(
    cost.gitProcesses,
    'read the inventory: Git processes per request',
  ).toBeLessThanOrEqual(ROUTE_BUDGETS.readInventory.gitProcesses);
});

test("reading a worktree's changes stays within its budget", async ({
  session,
  recorder,
}) => {
  const from = recorder.steps.length;

  const responses = await sendAll(
    session,
    repeated({ method: 'GET', path: worktreePath(session, '/changes') }),
  );

  expect(responses.map((response) => response.status)).toStrictEqual(
    answeredEach,
  );
  for (const response of responses)
    expect(response.body).toEqual(
      expect.schemaMatching(readChangesResponseSchema),
    );
  const cost = measured(recorder, from);
  expect(cost.requests).toBe(ROUTE_BUDGET_REQUESTS);
  expect(cost.p95Ms, "read a worktree's changes: p95 ms").toBeLessThanOrEqual(
    ROUTE_BUDGETS.readChanges.p95Ms,
  );
  expect(
    cost.gitProcesses,
    "read a worktree's changes: Git processes per request",
  ).toBeLessThanOrEqual(ROUTE_BUDGETS.readChanges.gitProcesses);
});

test('reading the Git status stays within its budget, counted by the Git trace', async ({
  session,
  recorder,
}) => {
  const from = recorder.steps.length;

  const responses = await sendAll(
    session,
    repeated({ method: 'GET', path: worktreePath(session, '/git/status') }),
  );

  expect(responses.map((response) => response.status)).toStrictEqual(
    answeredEach,
  );
  for (const response of responses)
    expect(response.body).toEqual(
      expect.schemaMatching(readGitStatusResponseSchema),
    );
  const cost = measured(recorder, from);
  expect(cost.requests).toBe(ROUTE_BUDGET_REQUESTS);
  expect(
    cost.gitProcesses,
    'git trace: the perf sample recorded no Git process for a status read, so its budgets counted nothing',
  ).toBeGreaterThan(0);
  expect(cost.p95Ms, 'read the Git status: p95 ms').toBeLessThanOrEqual(
    ROUTE_BUDGETS.readGitStatus.p95Ms,
  );
  expect(
    cost.gitProcesses,
    'read the Git status: Git processes per request',
  ).toBeLessThanOrEqual(ROUTE_BUDGETS.readGitStatus.gitProcesses);
});

test('reading a changed file stays within its budget', async ({
  session,
  recorder,
}) => {
  const path = await firstSource(session);
  const from = recorder.steps.length;

  const responses = await sendAll(
    session,
    repeated({
      method: 'GET',
      path: worktreePath(session, '/text'),
      query: { path },
    }),
  );

  expect(responses.map((response) => response.status)).toStrictEqual(
    answeredEach,
  );
  for (const response of responses)
    expect(response.body).toEqual(
      expect.schemaMatching(readTextFileResponseSchema),
    );
  const cost = measured(recorder, from);
  expect(cost.requests).toBe(ROUTE_BUDGET_REQUESTS);
  expect(cost.p95Ms, 'read a changed file: p95 ms').toBeLessThanOrEqual(
    ROUTE_BUDGETS.readTextFile.p95Ms,
  );
  expect(
    cost.gitProcesses,
    'read a changed file: Git processes per request',
  ).toBeLessThanOrEqual(ROUTE_BUDGETS.readTextFile.gitProcesses);
});

test("reading a change's diff stays within its budget", async ({
  session,
  recorder,
}) => {
  const state = await changedSources(session);
  const from = recorder.steps.length;

  const responses = await sendAll(
    session,
    state.sources.map((source) => ({
      method: 'POST' as const,
      path: worktreePath(session, '/changes/diffs'),
      body: {
        expectedStatusToken: state.statusToken,
        expectedFiles: [source],
        selections: [
          { scope: 'unstaged', oldPath: source.path, newPath: source.path },
        ],
      },
    })),
  );

  expect(responses.map((response) => response.status)).toStrictEqual(
    answeredEach,
  );
  for (const response of responses)
    expect(response.body).toEqual(
      expect.schemaMatching(readChangeDiffsResponseSchema),
    );
  const cost = measured(recorder, from);
  expect(cost.requests).toBe(ROUTE_BUDGET_REQUESTS);
  expect(cost.p95Ms, "read a change's diff: p95 ms").toBeLessThanOrEqual(
    ROUTE_BUDGETS.readChangeDiffs.p95Ms,
  );
  expect(
    cost.gitProcesses,
    "read a change's diff: Git processes per request",
  ).toBeLessThanOrEqual(ROUTE_BUDGETS.readChangeDiffs.gitProcesses);
});

test('listing the commit history stays within its budget', async ({
  session,
  recorder,
}) => {
  const from = recorder.steps.length;

  const responses = await sendAll(
    session,
    repeated({ method: 'GET', path: worktreePath(session, '/commits') }),
  );

  expect(responses.map((response) => response.status)).toStrictEqual(
    answeredEach,
  );
  for (const response of responses)
    expect(response.body).toEqual(
      expect.schemaMatching(listCommitsResponseSchema),
    );
  const cost = measured(recorder, from);
  expect(cost.requests).toBe(ROUTE_BUDGET_REQUESTS);
  expect(cost.p95Ms, 'list the commit history: p95 ms').toBeLessThanOrEqual(
    ROUTE_BUDGETS.listCommits.p95Ms,
  );
  expect(
    cost.gitProcesses,
    'list the commit history: Git processes per request',
  ).toBeLessThanOrEqual(ROUTE_BUDGETS.listCommits.gitProcesses);
});

test("listing a file's commits stays within its budget", async ({
  session,
  recorder,
}) => {
  const path = await firstSource(session);
  const from = recorder.steps.length;

  const responses = await sendAll(
    session,
    repeated({
      method: 'GET',
      path: worktreePath(session, '/file-commits'),
      query: { path },
    }),
  );

  expect(responses.map((response) => response.status)).toStrictEqual(
    answeredEach,
  );
  for (const response of responses)
    expect(response.body).toEqual(
      expect.schemaMatching(listFileCommitsResponseSchema),
    );
  const cost = measured(recorder, from);
  expect(cost.requests).toBe(ROUTE_BUDGET_REQUESTS);
  expect(cost.p95Ms, "list a file's commits: p95 ms").toBeLessThanOrEqual(
    ROUTE_BUDGETS.listFileCommits.p95Ms,
  );
  expect(
    cost.gitProcesses,
    "list a file's commits: Git processes per request",
  ).toBeLessThanOrEqual(ROUTE_BUDGETS.listFileCommits.gitProcesses);
});

test('listing every path in a worktree stays within its budget', async ({
  session,
  recorder,
}) => {
  const from = recorder.steps.length;

  const responses = await sendAll(
    session,
    repeated({ method: 'GET', path: worktreePath(session, '/paths') }),
  );

  expect(responses.map((response) => response.status)).toStrictEqual(
    answeredEach,
  );
  for (const response of responses)
    expect(response.body).toEqual(
      expect.schemaMatching(listWorktreePathsResponseSchema),
    );
  const cost = measured(recorder, from);
  expect(cost.requests).toBe(ROUTE_BUDGET_REQUESTS);
  expect(
    cost.p95Ms,
    'list every path in a worktree: p95 ms',
  ).toBeLessThanOrEqual(ROUTE_BUDGETS.listWorktreePaths.p95Ms);
  expect(
    cost.gitProcesses,
    'list every path in a worktree: Git processes per request',
  ).toBeLessThanOrEqual(ROUTE_BUDGETS.listWorktreePaths.gitProcesses);
});

test('listing a folder stays within its budget', async ({
  session,
  recorder,
}) => {
  const path = await firstSource(session);
  const from = recorder.steps.length;

  const responses = await sendAll(
    session,
    repeated({
      method: 'GET',
      path: worktreePath(session, '/directory'),
      query: { path: parentOf(path) },
    }),
  );

  expect(responses.map((response) => response.status)).toStrictEqual(
    answeredEach,
  );
  for (const response of responses)
    expect(response.body).toEqual(
      expect.schemaMatching(listDirectoryResponseSchema),
    );
  const cost = measured(recorder, from);
  expect(cost.requests).toBe(ROUTE_BUDGET_REQUESTS);
  expect(cost.p95Ms, 'list a folder: p95 ms').toBeLessThanOrEqual(
    ROUTE_BUDGETS.listDirectory.p95Ms,
  );
  expect(
    cost.gitProcesses,
    'list a folder: Git processes per request',
  ).toBeLessThanOrEqual(ROUTE_BUDGETS.listDirectory.gitProcesses);
});

test('marking files reviewed stays within its budget', async ({
  session,
  recorder,
}) => {
  const state = await changedSources(session);
  const from = recorder.steps.length;

  const responses = await sendAll(
    session,
    state.sources.map((source) => ({
      method: 'PUT' as const,
      path: worktreePath(session, '/reviewed'),
      body: { ...source, reviewed: true },
    })),
  );

  expect(responses.map((response) => response.status)).toStrictEqual(
    answeredEach,
  );
  for (const response of responses)
    expect(response.body).toEqual(
      expect.schemaMatching(setReviewedFileResponseSchema),
    );
  const cost = measured(recorder, from);
  expect(cost.requests).toBe(ROUTE_BUDGET_REQUESTS);
  expect(cost.p95Ms, 'mark files reviewed: p95 ms').toBeLessThanOrEqual(
    ROUTE_BUDGETS.markReviewed.p95Ms,
  );
  expect(
    cost.gitProcesses,
    'mark files reviewed: Git processes per request',
  ).toBeLessThanOrEqual(ROUTE_BUDGETS.markReviewed.gitProcesses);
});

test('listing reviewed files stays within its budget', async ({
  session,
  recorder,
}) => {
  const from = recorder.steps.length;

  const responses = await sendAll(
    session,
    repeated({ method: 'GET', path: worktreePath(session, '/reviewed') }),
  );

  expect(responses.map((response) => response.status)).toStrictEqual(
    answeredEach,
  );
  for (const response of responses)
    expect(response.body).toEqual(
      expect.schemaMatching(listReviewedFilesResponseSchema),
    );
  const cost = measured(recorder, from);
  expect(cost.requests).toBe(ROUTE_BUDGET_REQUESTS);
  expect(cost.p95Ms, 'list reviewed files: p95 ms').toBeLessThanOrEqual(
    ROUTE_BUDGETS.listReviewed.p95Ms,
  );
  expect(
    cost.gitProcesses,
    'list reviewed files: Git processes per request',
  ).toBeLessThanOrEqual(ROUTE_BUDGETS.listReviewed.gitProcesses);
});

test('unmarking files reviewed stays within its budget', async ({
  session,
  recorder,
}) => {
  const state = await changedSources(session);
  const from = recorder.steps.length;

  const responses = await sendAll(
    session,
    state.sources.map((source) => ({
      method: 'DELETE' as const,
      path: worktreePath(session, '/reviewed'),
      query: { path: source.path },
    })),
  );

  expect(responses.map((response) => response.status)).toStrictEqual(
    answeredEach,
  );
  for (const response of responses)
    expect(response.body).toEqual(
      expect.schemaMatching(removeReviewedFileResponseSchema),
    );
  const cost = measured(recorder, from);
  expect(cost.requests).toBe(ROUTE_BUDGET_REQUESTS);
  expect(cost.p95Ms, 'unmark files reviewed: p95 ms').toBeLessThanOrEqual(
    ROUTE_BUDGETS.unmarkReviewed.p95Ms,
  );
  expect(
    cost.gitProcesses,
    'unmark files reviewed: Git processes per request',
  ).toBeLessThanOrEqual(ROUTE_BUDGETS.unmarkReviewed.gitProcesses);
});

test('commenting on files stays within its budget', async ({
  session,
  recorder,
}) => {
  const state = await changedSources(session);
  const from = recorder.steps.length;

  const responses = await sendAll(
    session,
    state.sources.map((source) => ({
      method: 'POST' as const,
      path: worktreePath(session, '/comments'),
      body: {
        anchor: { kind: 'file', filePath: source.path },
        body: 'Worth a second look',
      },
    })),
  );

  expect(responses.map((response) => response.status)).toStrictEqual(
    answeredEach,
  );
  for (const response of responses)
    expect(response.body).toEqual(
      expect.schemaMatching(createCommentThreadResponseSchema),
    );
  const cost = measured(recorder, from);
  expect(cost.requests).toBe(ROUTE_BUDGET_REQUESTS);
  expect(cost.p95Ms, 'comment on files: p95 ms').toBeLessThanOrEqual(
    ROUTE_BUDGETS.createComment.p95Ms,
  );
  expect(
    cost.gitProcesses,
    'comment on files: Git processes per request',
  ).toBeLessThanOrEqual(ROUTE_BUDGETS.createComment.gitProcesses);
});

test('reading the comments stays within its budget', async ({
  session,
  recorder,
}) => {
  const from = recorder.steps.length;

  const responses = await sendAll(
    session,
    repeated({ method: 'GET', path: worktreePath(session, '/comments') }),
  );

  expect(responses.map((response) => response.status)).toStrictEqual(
    answeredEach,
  );
  for (const response of responses)
    expect(response.body).toEqual(
      expect.schemaMatching(listCommentThreadsResponseSchema),
    );
  const cost = measured(recorder, from);
  expect(cost.requests).toBe(ROUTE_BUDGET_REQUESTS);
  expect(cost.p95Ms, 'read the comments: p95 ms').toBeLessThanOrEqual(
    ROUTE_BUDGETS.listComments.p95Ms,
  );
  expect(
    cost.gitProcesses,
    'read the comments: Git processes per request',
  ).toBeLessThanOrEqual(ROUTE_BUDGETS.listComments.gitProcesses);
});

test('reading the published review stays within its budget', async ({
  session,
  recorder,
}) => {
  await read(session, {
    method: 'PUT',
    path: worktreePath(session, '/review'),
    body: sampleReview(session, 0, randomUUID(), randomUUID()),
  });
  const from = recorder.steps.length;

  const responses = await sendAll(
    session,
    repeated({ method: 'GET', path: worktreePath(session, '/review') }),
  );

  expect(responses.map((response) => response.status)).toStrictEqual(
    answeredEach,
  );
  for (const response of responses)
    expect(response.body).toEqual(
      expect.schemaMatching(readPublishedReviewResponseSchema),
    );
  const cost = measured(recorder, from);
  expect(cost.requests).toBe(ROUTE_BUDGET_REQUESTS);
  expect(cost.p95Ms, 'read the published review: p95 ms').toBeLessThanOrEqual(
    ROUTE_BUDGETS.readPublishedReview.p95Ms,
  );
  expect(
    cost.gitProcesses,
    'read the published review: Git processes per request',
  ).toBeLessThanOrEqual(ROUTE_BUDGETS.readPublishedReview.gitProcesses);
});
