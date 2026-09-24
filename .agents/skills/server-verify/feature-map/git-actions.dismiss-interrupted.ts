import { randomUUID } from 'node:crypto';
import { dismissInterruptedGitActionResponseSchema } from '@porcelain/contracts/git-actions';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  unknownUuid,
} from '../scripts/feature.ts';
import {
  expectation,
  gitPath,
  gitRoute,
  read,
  receiptOf,
  settledReceipt,
  worktreePath,
} from '../scripts/fixture.ts';

const mismatch = apiError(
  409,
  'Conflict',
  'Git action request does not match its receipt',
);

export default defineFeature({
  feature: 'git-actions.dismiss-interrupted',
  reaches: `DELETE ${gitRoute}/interrupted/:requestId`,
  paired: true,
  intent: 'intended',
  behaviour:
    "After an action ended interrupted, the worktree's changes carry an interrupted marker naming it until the owner dismisses it by request ID; dismissing clears the marker, keeps the receipt, and dismissing again answers the same. The isolated session cannot stop the server mid-action, so the interrupted action here is a fetch from a remote that does not exist, which the server settles as interrupted (see SURPRISES.md). An unknown request is not found, and dismissing a request that did not end interrupted is a mismatch conflict.",
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
        await session.read(
          {
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
          },
          202,
        );
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
      name: 'an interrupted action is marked until it is dismissed',
      async setup(session) {
        await session.git(
          'remote',
          'add',
          'gone',
          `${session.projectHome}/gone.git`,
        );
        const requestId = randomUUID();
        await session.read(
          {
            method: 'POST',
            path: gitPath(session, '/actions'),
            body: {
              requestId,
              input: {
                action: 'fetch',
                remoteName: 'gone',
                sourceRef: `refs/heads/${session.fixture.branch}`,
              },
              expected: { ...(await expectation(session)), upstreamOid: null },
            },
          },
          202,
        );
        const settled = await settledReceipt(session, requestId);
        const marked = await read(session, {
          method: 'GET',
          path: worktreePath(session, '/changes'),
        });
        return {
          requestId,
          state: settled.receipt.state,
          marker: marked.interrupted,
          unmarked: Object.keys(marked).filter((key) => key !== 'interrupted'),
        };
      },
      request: (session, state) => [
        {
          method: 'DELETE',
          path: gitPath(session, `/interrupted/${state.requestId}`),
        },
        {
          method: 'DELETE',
          path: gitPath(session, `/interrupted/${state.requestId}`),
        },
      ],
      async expect({
        responses,
        state,
        session,
        check,
        checkPartial,
        checkContract,
      }) {
        check('the fetch ended interrupted', 'interrupted', state.state);
        checkPartial(
          'the changes carried the marker',
          { requestId: state.requestId, action: 'fetch' },
          state.marker,
        );
        check('dismissed status', 200, responses[0]?.status);
        checkContract(
          'contract',
          dismissInterruptedGitActionResponseSchema,
          responses[0]?.body,
        );
        check('dismissed body', { dismissed: true }, responses[0]?.body);
        check('dismissing again status', 200, responses[1]?.status);
        check('dismissing again body', { dismissed: true }, responses[1]?.body);
        const after = await read(session, {
          method: 'GET',
          path: worktreePath(session, '/changes'),
        });
        check('the marker is gone', state.unmarked, Object.keys(after));
        checkPartial(
          'the receipt is kept',
          { requestId: state.requestId, state: 'interrupted' },
          await receiptOf(session, state.requestId),
        );
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
