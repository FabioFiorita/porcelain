import { readGitActionReceiptResponseSchema } from '@porcelain/contracts/git-actions';
import * as Schema from 'effect/Schema';
import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { apiError, invalidRequest, UNKNOWN_UUID } from '../kit/answers.ts';
import {
  expectation,
  fingerprintOf,
  head,
  settledReceipt,
} from '../kit/reads.ts';
import { gitPath, receiptPath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';

test('reading the receipt of a settled commit names the project, worktree, action, state and new head', async ({
  session,
}) => {
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
          files: [{ path, fingerprint: await fingerprintOf(session, path) }],
        },
      },
    },
    202,
  );
  await settledReceipt(session, requestId);

  const response = await session.send({
    method: 'GET',
    path: receiptPath(session, requestId),
  });

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(readGitActionReceiptResponseSchema),
      ),
    ),
  );
  expect(response.body).toMatchObject({
    requestId,
    projectId: session.projectId,
    worktreeId: session.worktreeId,
    action: 'commit',
    state: 'succeeded',
    progress: [],
    result: { headOid: await head(session) },
  });
});

test('reading a receipt by an unknown request id is not found and by a malformed one is refused', async ({
  session,
}) => {
  const unknown = await session.send({
    method: 'GET',
    path: receiptPath(session, UNKNOWN_UUID),
  });
  const malformed = await session.send({
    method: 'GET',
    path: receiptPath(session, 'not-a-uuid'),
  });

  expect(unknown.status).toBe(404);
  expect(unknown.body).toStrictEqual(
    apiError(404, 'Not Found', 'Git action receipt not found'),
  );
  expect(malformed.status).toBe(400);
  expect(malformed.body).toStrictEqual(invalidRequest);
});
