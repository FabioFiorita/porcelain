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
import {
  ROUTE_BUDGETS,
  ROUTE_BUDGET_REQUESTS,
} from '../../../../apps/server/src/config/limits.ts';
import {
  defineCase,
  defineFeature,
  list,
  record,
  type ContractSchema,
  type HttpRequest,
  type HttpResponse,
  type Outcome,
  type PerfSample,
  type Session,
} from '../scripts/feature.ts';
import {
  changes,
  read,
  sampleReview,
  worktreePath,
} from '../scripts/fixture.ts';

const repeated = (request: HttpRequest) =>
  Array.from({ length: ROUTE_BUDGET_REQUESTS }, () => request);

function answered(
  outcome: Outcome<unknown>,
  status: number,
  schema: ContractSchema,
) {
  outcome.check(
    'every request answered',
    outcome.responses.map(() => status),
    outcome.responses.map((response: HttpResponse) => response.status),
  );
  for (const [index, response] of outcome.responses.entries())
    outcome.checkContract(`answer ${index + 1}`, schema, response.body);
}

function sampleOf(session: Session): PerfSample {
  if (session.fixture.perf === null)
    throw new Error('perf.routes runs on the perf sample');
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

export default defineFeature({
  feature: 'perf.routes',
  reaches: [
    'POST /api/projects',
    'GET /api/inventory',
    'GET /api/worktrees/:worktreeId/changes',
    'GET /api/worktrees/:worktreeId/git/status',
    'GET /api/worktrees/:worktreeId/text',
    'POST /api/worktrees/:worktreeId/changes/diffs',
    'GET /api/worktrees/:worktreeId/commits',
    'GET /api/worktrees/:worktreeId/file-commits',
    'GET /api/worktrees/:worktreeId/paths',
    'GET /api/worktrees/:worktreeId/directory',
    'PUT /api/worktrees/:worktreeId/reviewed',
    'GET /api/worktrees/:worktreeId/reviewed',
    'DELETE /api/worktrees/:worktreeId/reviewed',
    'POST /api/worktrees/:worktreeId/comments',
    'GET /api/worktrees/:worktreeId/comments',
    'GET /api/worktrees/:worktreeId/review',
  ],
  paired: true,
  intent: 'intended',
  sample: 'perf',
  behaviour:
    'On a large repository (tens of thousands of tracked files, thousands of commits, a few hundred uncommitted changes, several linked worktrees and several registered projects) the routes a reviewer uses every minute answer within their budgets: a wall-time ceiling on the slowest of a few repeated requests and a ceiling on the Git processes each request launches. Registering a project refreshes the whole inventory, so its budget is the cost of one refresh across every registered project.',
  cases: [
    defineCase({
      name: 'register a project',
      budget: ROUTE_BUDGETS.registerProject,
      request: (session) =>
        sampleOf(session).projects.map((project) => ({
          method: 'POST' as const,
          path: '/api/projects',
          body: { path: join(session.projectHome, project) },
        })),
      expect(outcome) {
        answered(outcome, 200, registerProjectResponseSchema);
      },
    }),
    defineCase({
      name: 'read the inventory',
      budget: ROUTE_BUDGETS.readInventory,
      request: () => repeated({ method: 'GET', path: '/api/inventory' }),
      expect(outcome) {
        answered(outcome, 200, readInventoryResponseSchema);
        outcome.check(
          'every project is listed',
          outcome.responses.map(
            () => sampleOf(outcome.session).projects.length + 1,
          ),
          outcome.responses.map(
            (response) => list(record(response.body).projects).length,
          ),
        );
      },
    }),
    defineCase({
      name: "read a worktree's changes",
      budget: ROUTE_BUDGETS.readChanges,
      request: (session) =>
        repeated({ method: 'GET', path: worktreePath(session, '/changes') }),
      expect(outcome) {
        answered(outcome, 200, readChangesResponseSchema);
      },
    }),
    defineCase({
      name: 'read the Git status',
      budget: ROUTE_BUDGETS.readGitStatus,
      request: (session) =>
        repeated({ method: 'GET', path: worktreePath(session, '/git/status') }),
      expect(outcome) {
        answered(outcome, 200, readGitStatusResponseSchema);
      },
    }),
    defineCase({
      name: 'read a changed file',
      budget: ROUTE_BUDGETS.readTextFile,
      setup: firstSource,
      request: (session, path) =>
        repeated({
          method: 'GET',
          path: worktreePath(session, '/text'),
          query: { path },
        }),
      expect(outcome) {
        answered(outcome, 200, readTextFileResponseSchema);
      },
    }),
    defineCase({
      name: "read a change's diff",
      budget: ROUTE_BUDGETS.readChangeDiffs,
      setup: changedSources,
      request: (session, state) =>
        state.sources.map((source) => ({
          method: 'POST' as const,
          path: worktreePath(session, '/changes/diffs'),
          body: {
            expectedStatusToken: state.statusToken,
            expectedFiles: [source],
            selections: [
              {
                scope: 'unstaged',
                oldPath: source.path,
                newPath: source.path,
              },
            ],
          },
        })),
      expect(outcome) {
        answered(outcome, 200, readChangeDiffsResponseSchema);
      },
    }),
    defineCase({
      name: 'list the commit history',
      budget: ROUTE_BUDGETS.listCommits,
      request: (session) =>
        repeated({ method: 'GET', path: worktreePath(session, '/commits') }),
      expect(outcome) {
        answered(outcome, 200, listCommitsResponseSchema);
      },
    }),
    defineCase({
      name: "list a file's commits",
      budget: ROUTE_BUDGETS.listFileCommits,
      setup: firstSource,
      request: (session, path) =>
        repeated({
          method: 'GET',
          path: worktreePath(session, '/file-commits'),
          query: { path },
        }),
      expect(outcome) {
        answered(outcome, 200, listFileCommitsResponseSchema);
      },
    }),
    defineCase({
      name: 'list every path in a worktree',
      budget: ROUTE_BUDGETS.listWorktreePaths,
      request: (session) =>
        repeated({ method: 'GET', path: worktreePath(session, '/paths') }),
      expect(outcome) {
        answered(outcome, 200, listWorktreePathsResponseSchema);
      },
    }),
    defineCase({
      name: 'list a folder',
      budget: ROUTE_BUDGETS.listDirectory,
      setup: firstSource,
      request: (session, path) =>
        repeated({
          method: 'GET',
          path: worktreePath(session, '/directory'),
          query: { path: parentOf(path) },
        }),
      expect(outcome) {
        answered(outcome, 200, listDirectoryResponseSchema);
      },
    }),
    defineCase({
      name: 'mark files reviewed',
      budget: ROUTE_BUDGETS.markReviewed,
      setup: changedSources,
      request: (session, state) =>
        state.sources.map((source) => ({
          method: 'PUT' as const,
          path: worktreePath(session, '/reviewed'),
          body: { ...source, reviewed: true },
        })),
      expect(outcome) {
        answered(outcome, 200, setReviewedFileResponseSchema);
      },
    }),
    defineCase({
      name: 'list reviewed files',
      budget: ROUTE_BUDGETS.listReviewed,
      request: (session) =>
        repeated({ method: 'GET', path: worktreePath(session, '/reviewed') }),
      expect(outcome) {
        answered(outcome, 200, listReviewedFilesResponseSchema);
      },
    }),
    defineCase({
      name: 'unmark files reviewed',
      budget: ROUTE_BUDGETS.unmarkReviewed,
      setup: changedSources,
      request: (session, state) =>
        state.sources.map((source) => ({
          method: 'DELETE' as const,
          path: worktreePath(session, '/reviewed'),
          query: { path: source.path },
        })),
      expect(outcome) {
        answered(outcome, 200, removeReviewedFileResponseSchema);
      },
    }),
    defineCase({
      name: 'comment on files',
      budget: ROUTE_BUDGETS.createComment,
      setup: changedSources,
      request: (session, state) =>
        state.sources.map((source) => ({
          method: 'POST' as const,
          path: worktreePath(session, '/comments'),
          body: {
            anchor: { kind: 'file', filePath: source.path },
            body: 'Worth a second look',
          },
        })),
      expect(outcome) {
        answered(outcome, 200, createCommentThreadResponseSchema);
      },
    }),
    defineCase({
      name: 'read the comments',
      budget: ROUTE_BUDGETS.listComments,
      request: (session) =>
        repeated({ method: 'GET', path: worktreePath(session, '/comments') }),
      expect(outcome) {
        answered(outcome, 200, listCommentThreadsResponseSchema);
      },
    }),
    defineCase({
      name: 'read the published review',
      budget: ROUTE_BUDGETS.readPublishedReview,
      setup: (session) =>
        read(session, {
          method: 'PUT',
          path: worktreePath(session, '/review'),
          body: sampleReview(session, 0, randomUUID(), randomUUID()),
        }),
      request: (session) =>
        repeated({ method: 'GET', path: worktreePath(session, '/review') }),
      expect(outcome) {
        answered(outcome, 200, readPublishedReviewResponseSchema);
      },
    }),
  ],
});
