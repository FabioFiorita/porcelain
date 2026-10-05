import * as Schema from 'effect/Schema';
import { randomUUID } from 'node:crypto';
import { dismissInterruptedGitActionResponseSchema } from '@porcelain/contracts/git-actions';
import { expect } from 'vitest';
import { apiError, invalidRequest, UNKNOWN_UUID } from '../kit/answers.ts';
import {
  expectation,
  fingerprintOf,
  receiptOf,
  settledReceipt,
} from '../kit/reads.ts';
import { gitPath, read, worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';

const ALTERNATES = '.git/objects/info/alternates';

const mismatch = apiError(
  409,
  'Conflict',
  'Git action request does not match its receipt',
);

test('dismissing an interruption for a request the server does not know is not found', async ({
  session,
}) => {
  const response = await session.send({
    method: 'DELETE',
    path: gitPath(session, `/interrupted/${UNKNOWN_UUID}`),
  });

  expect(response.status).toBe(404);
  expect(response.body).toStrictEqual(
    apiError(404, 'Not Found', 'Git action receipt not found'),
  );
});

test('dismissing an interruption for a request that was not interrupted is a mismatch conflict', async ({
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
    method: 'DELETE',
    path: gitPath(session, `/interrupted/${requestId}`),
  });

  expect(response.status).toBe(409);
  expect(response.body).toStrictEqual(mismatch);
});

test('an interrupted action marks the changes until it is dismissed, and dismissing again answers the same', async ({
  session,
}) => {
  const path = session.fixture.readme.path;
  const expected = {
    ...(await expectation(session)),
    files: [{ path, fingerprint: await fingerprintOf(session, path) }],
  };
  await session.fifo(ALTERNATES);
  const requestId = randomUUID();
  await session.read(
    {
      method: 'POST',
      path: gitPath(session, '/actions'),
      body: {
        requestId,
        input: {
          action: 'commit',
          message: 'Stuck',
          paths: [path],
        },
        expected,
      },
    },
    202,
  );
  const settled = await settledReceipt(session, requestId);
  await session.remove(ALTERNATES);
  const marked = await read(session, {
    method: 'GET',
    path: worktreePath(session, '/changes'),
  });
  const unmarked = Object.keys(marked).filter((key) => key !== 'interrupted');

  const dismissed = await session.send({
    method: 'DELETE',
    path: gitPath(session, `/interrupted/${requestId}`),
  });
  const again = await session.send({
    method: 'DELETE',
    path: gitPath(session, `/interrupted/${requestId}`),
  });

  expect(settled.receipt.state).toBe('interrupted');
  expect(marked.interrupted).toMatchObject({ requestId, action: 'commit' });
  expect(dismissed.status).toBe(200);
  expect(dismissed.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(dismissInterruptedGitActionResponseSchema),
      ),
    ),
  );
  expect(dismissed.body).toStrictEqual({ dismissed: true });
  expect(again.status).toBe(200);
  expect(again.body).toStrictEqual({ dismissed: true });
  const after = await read(session, {
    method: 'GET',
    path: worktreePath(session, '/changes'),
  });
  expect(Object.keys(after)).toStrictEqual(unmarked);
  expect(await receiptOf(session, requestId)).toMatchObject({
    requestId,
    state: 'interrupted',
  });
});

test('dismissing an interruption with a malformed request id is refused', async ({
  session,
}) => {
  const response = await session.send({
    method: 'DELETE',
    path: gitPath(session, '/interrupted/not-a-uuid'),
  });

  expect(response.status).toBe(400);
  expect(response.body).toStrictEqual(invalidRequest);
});
