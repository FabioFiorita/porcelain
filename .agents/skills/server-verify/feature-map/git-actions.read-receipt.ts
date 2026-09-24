import { randomUUID } from 'node:crypto';
import { readGitActionReceiptResponseSchema } from '@porcelain/contracts/git-actions';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  unknownOid,
  unknownUuid,
} from '../scripts/feature.ts';
import { expectation, gitPath, settledReceipt } from '../scripts/fixture.ts';

export default defineFeature({
  feature: 'git-actions.read-receipt',
  reaches: 'GET /api/git-action-requests/:requestId',
  paired: true,
  intent: 'observed',
  behaviour:
    'A client follows a Git action by its request ID: the receipt names the project, worktree and action, its state, progress lines, result and timestamps. Reading a settled receipt answers 200 whatever the outcome; an unknown request ID is not found.',
  cases: [
    defineCase({
      name: 'a settled action',
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
      request: (_session, requestId) => ({
        method: 'GET',
        path: `/api/git-action-requests/${requestId}`,
      }),
      expect({ response, state, session, check, checkPartial, checkContract }) {
        check('status', 200, response.status);
        checkContract(
          'contract',
          readGitActionReceiptResponseSchema,
          response.body,
        );
        checkPartial(
          'receipt',
          {
            requestId: state,
            projectId: session.projectId,
            worktreeId: session.worktreeId,
            action: 'create-branch',
            state: 'succeeded',
            progress: [],
            result: { branch: 'feature' },
          },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'a rejected action',
      async setup(session) {
        const requestId = randomUUID();
        await session.send({
          method: 'POST',
          path: gitPath(session, '/actions'),
          body: {
            requestId,
            input: {
              action: 'create-branch',
              branch: 'too-late',
              switchTo: false,
            },
            expected: { ...(await expectation(session)), headOid: unknownOid },
          },
        });
        await settledReceipt(session, requestId);
        return requestId;
      },
      request: (_session, requestId) => ({
        method: 'GET',
        path: `/api/git-action-requests/${requestId}`,
      }),
      expect({ response, state, check, checkPartial, checkContract }) {
        check('status', 200, response.status);
        checkContract(
          'contract',
          readGitActionReceiptResponseSchema,
          response.body,
        );
        checkPartial(
          'receipt',
          {
            requestId: state,
            action: 'create-branch',
            state: 'rejected',
            reason: 'CHANGED_SINCE_LOOKED',
          },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'unknown or malformed request ID',
      request: () => [
        { method: 'GET', path: `/api/git-action-requests/${unknownUuid}` },
        { method: 'GET', path: '/api/git-action-requests/not-a-uuid' },
      ],
      expect({ responses, check }) {
        check('unknown status', 404, responses[0]?.status);
        check(
          'unknown error body',
          apiError(404, 'Not Found', 'Git action receipt not found'),
          responses[0]?.body,
        );
        check('malformed status', 400, responses[1]?.status);
        check('malformed error body', invalidRequest, responses[1]?.body);
      },
    }),
  ],
});
