import { randomUUID } from 'node:crypto';
import { readGitActionReceiptResponseSchema } from '@porcelain/contracts/git-actions';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  unknownOid,
  unknownUuid,
  unknownWorktreeId,
} from '../scripts/feature.ts';
import {
  expectation,
  fingerprintOf,
  gitPath,
  head,
  receiptPath,
  receiptRoute,
  settledReceipt,
} from '../scripts/fixture.ts';

export default defineFeature({
  feature: 'git-actions.read-receipt',
  reaches: `GET ${receiptRoute}`,
  paired: true,
  intent: 'observed',
  behaviour:
    'A client follows a Git action by its request ID: the receipt names the project, worktree and action, its state, progress lines, result and timestamps. Reading a settled receipt answers 200 whatever the outcome; an unknown request ID is not found, and so is a receipt read through a worktree other than its own.',
  cases: [
    defineCase({
      name: 'a settled action',
      async setup(session) {
        const path = 'note.txt';
        await session.writeFile(path, 'A note\n');
        const requestId = randomUUID();
        await session.read(
          {
            method: 'POST',
            path: gitPath(session, '/actions'),
            body: {
              requestId,
              input: {
                action: 'commit',
                message: 'Keep a note',
                paths: [path],
              },
              expected: {
                ...(await expectation(session)),
                files: [
                  { path, fingerprint: await fingerprintOf(session, path) },
                ],
              },
            },
          },
          202,
        );
        await settledReceipt(session, requestId);
        return requestId;
      },
      request: (session, requestId) => ({
        method: 'GET',
        path: receiptPath(session, requestId),
      }),
      async expect({
        response,
        state,
        session,
        check,
        checkPartial,
        checkContract,
      }) {
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
            action: 'commit',
            state: 'succeeded',
            progress: [],
            result: { headOid: await head(session) },
          },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'a rejected action',
      async setup(session) {
        const requestId = randomUUID();
        await session.read(
          {
            method: 'POST',
            path: gitPath(session, '/actions'),
            body: {
              requestId,
              input: {
                action: 'fetch',
                remoteName: 'origin',
                sourceRef: `refs/heads/${session.fixture.branch}`,
              },
              expected: {
                ...(await expectation(session)),
                headOid: unknownOid,
                upstreamOid: unknownOid,
              },
            },
          },
          202,
        );
        await settledReceipt(session, requestId);
        return requestId;
      },
      request: (session, requestId) => ({
        method: 'GET',
        path: receiptPath(session, requestId),
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
            action: 'fetch',
            state: 'rejected',
            reason: 'CHANGED_SINCE_LOOKED',
          },
          response.body,
        );
      },
    }),
    defineCase({
      name: "another worktree's receipt",
      async setup(session) {
        const requestId = randomUUID();
        await session.read(
          {
            method: 'POST',
            path: gitPath(session, '/actions'),
            body: {
              requestId,
              input: {
                action: 'fetch',
                remoteName: 'origin',
                sourceRef: `refs/heads/${session.fixture.branch}`,
              },
              expected: {
                ...(await expectation(session)),
                headOid: unknownOid,
                upstreamOid: unknownOid,
              },
            },
          },
          202,
        );
        await settledReceipt(session, requestId);
        return requestId;
      },
      request: (session, requestId) => ({
        method: 'GET',
        path: receiptPath(session, requestId, unknownWorktreeId),
      }),
      expect({ response, check }) {
        check('status', 404, response.status);
        check(
          'error body',
          apiError(404, 'Not Found', 'Worktree not found'),
          response.body,
        );
      },
    }),
    defineCase({
      name: 'unknown or malformed request ID',
      request: (session) => [
        { method: 'GET', path: receiptPath(session, unknownUuid) },
        { method: 'GET', path: receiptPath(session, 'not-a-uuid') },
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
