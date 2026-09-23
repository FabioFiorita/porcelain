import { randomUUID } from 'node:crypto';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  unknownUuid,
} from '../scripts/feature.ts';
import { expectation, gitPath, settledReceipt } from '../scripts/fixture.ts';

const mismatch = apiError(
  409,
  'Conflict',
  'Git action request does not match its receipt',
);

export default defineFeature({
  feature: 'git-actions.dismiss-interrupted',
  reaches:
    'DELETE /api/projects/:projectId/worktrees/:worktreeId/git/interrupted/:requestId',
  intent: 'intended',
  behaviour:
    "After an action was interrupted (the server stopped while it ran), the worktree's changes carry an interrupted marker until the owner dismisses it by request ID. Producing an interrupted action needs the server to stop mid-action, which the isolated session cannot do, so only refusals are verified: an unknown request is not found, and dismissing a request that did not end interrupted is a mismatch conflict.",
  cases: [
    defineCase({
      name: 'unknown request',
      request: (session) => ({
        method: 'DELETE',
        path: gitPath(session, `/interrupted/${unknownUuid}`),
      }),
      expect({ response, check }) {
        check('status', 404, response.status);
        check(
          'error body',
          apiError(404, 'Not Found', 'Git action receipt not found'),
          response.body,
        );
      },
    }),
    defineCase({
      name: 'a request that was not interrupted',
      async setup(session) {
        const requestId = randomUUID();
        await session.send({
          method: 'POST',
          path: gitPath(session, '/actions'),
          body: {
            requestId,
            input: {
              action: 'create-branch',
              branch: 'feature',
              switchTo: false,
            },
            expected: await expectation(session),
          },
        });
        await settledReceipt(session, requestId);
        return requestId;
      },
      request: (session, requestId) => ({
        method: 'DELETE',
        path: gitPath(session, `/interrupted/${requestId}`),
      }),
      expect({ response, check }) {
        check('status', 409, response.status);
        check('error body', mismatch, response.body);
      },
    }),
    defineCase({
      name: 'malformed request ID',
      request: (session) => ({
        method: 'DELETE',
        path: gitPath(session, '/interrupted/not-a-uuid'),
      }),
      expect({ response, check }) {
        check('status', 400, response.status);
        check('error body', invalidRequest, response.body);
      },
    }),
  ],
});
