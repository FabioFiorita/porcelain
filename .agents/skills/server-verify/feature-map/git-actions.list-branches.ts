import { listGitBranchesResponseSchema } from '@porcelain/contracts/git-actions';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  list,
  record,
  text,
  unknownUuid,
  unknownWorktreeId,
} from '../scripts/feature.ts';
import { gitPath, gitRoute, worktreeNotFound } from '../scripts/fixture.ts';

export default defineFeature({
  feature: 'git-actions.list-branches',
  reaches: `GET ${gitRoute}/branches`,
  paired: true,
  intent: 'intended',
  behaviour:
    "The owner lists a worktree's local branches, to switch or create one: the current branch and, for each branch, its upstream, last commit time and whether another worktree has it checked out. An unknown project is not found, and so is a worktree that is not one of the project's.",
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
      name: 'unknown project or worktree',
      request: (session) => [
        {
          method: 'GET',
          path: gitPath(session, '/branches', { projectId: unknownUuid }),
        },
        {
          method: 'GET',
          path: gitPath(session, '/branches', {
            worktreeId: unknownWorktreeId,
          }),
        },
      ],
      expect({ responses, check }) {
        check('unknown project status', 404, responses[0]?.status);
        check(
          'unknown project error body',
          apiError(404, 'Not Found', 'Project not found'),
          responses[0]?.body,
        );
        check('unknown worktree status', 404, responses[1]?.status);
        check(
          'unknown worktree error body',
          worktreeNotFound,
          responses[1]?.body,
        );
      },
    }),
    defineCase({
      name: 'malformed IDs',
      request: (session) => [
        {
          method: 'GET',
          path: gitPath(session, '/branches', { projectId: 'not-a-uuid' }),
        },
        {
          method: 'GET',
          path: gitPath(session, '/branches', { worktreeId: 'not-an-id' }),
        },
      ],
      expect({ responses, check }) {
        for (const [index, response] of responses.entries()) {
          check(`request ${index + 1} status`, 400, response.status);
          check(
            `request ${index + 1} error body`,
            invalidRequest,
            response.body,
          );
        }
      },
    }),
  ],
});
