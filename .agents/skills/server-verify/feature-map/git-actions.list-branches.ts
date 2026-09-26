import { listGitBranchesResponseSchema } from '@porcelain/contracts/git-actions';
import {
  defineCase,
  defineFeature,
  invalidRequest,
  list,
  record,
  text,
  unknownWorktreeId,
} from '../scripts/feature.ts';
import { gitPath, gitRoute, worktreeNotFound } from '../scripts/fixture.ts';

export default defineFeature({
  feature: 'git-actions.list-branches',
  reaches: `GET ${gitRoute}/branches`,
  paired: true,
  intent: 'intended',
  behaviour:
    "The owner lists a worktree's local branches, to switch or create one: the current branch and, for each branch, its upstream, last commit time and whether another worktree has it checked out. An unknown worktree is not found and a malformed worktree ID is invalid.",
  cases: [
    defineCase({
      name: 'main and a second branch',
      setup: (session) => session.git('branch', 'feature'),
      request: (session) => ({
        method: 'GET',
        path: gitPath(session, '/branches'),
      }),
      expect({
        response,
        session,
        check,
        checkPartial,
        checkContract,
        checkMatch,
      }) {
        check('status', 200, response.status);
        checkContract('contract', listGitBranchesResponseSchema, response.body);
        checkPartial(
          'body',
          {
            current: session.fixture.branch,
            branches: ['feature', session.fixture.branch]
              .sort()
              .map((name) => ({
                name,
                upstream: null,
                checkedOutElsewhere: false,
              })),
          },
          response.body,
        );
        for (const branch of list(record(response.body).branches))
          checkMatch(
            `${text(record(branch).name)} last commit time is an ISO instant`,
            /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/,
            record(branch).lastCommitAt,
          );
      },
    }),
    defineCase({
      name: 'unknown worktree',
      request: (session) => ({
        method: 'GET',
        path: gitPath(session, '/branches', { worktreeId: unknownWorktreeId }),
      }),
      expect({ response, check }) {
        check('status', 404, response.status);
        check('error body', worktreeNotFound, response.body);
      },
    }),
    defineCase({
      name: 'malformed worktree ID',
      request: (session) => ({
        method: 'GET',
        path: gitPath(session, '/branches', { worktreeId: 'not-an-id' }),
      }),
      expect({ response, check }) {
        check('status', 400, response.status);
        check('error body', invalidRequest, response.body);
      },
    }),
  ],
});
