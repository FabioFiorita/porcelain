import * as Schema from 'effect/Schema';
import { randomUUID } from 'node:crypto';
import { dismissInterruptedGitActionResponseSchema } from '@porcelain/contracts/git-actions';
import { expect } from 'vitest';
import {
  expectation,
  fingerprintOf,
  receiptOf,
  settledReceipt,
} from '../kit/reads.ts';
import { gitPath, read, worktreePath } from '../kit/requests.ts';
import { gitInterruptionTest as it } from '../kit/server-test.ts';

const ALTERNATES = '.git/objects/info/alternates';

it('the explicit interruption fixture shortens the Git action deadline to 1.5 seconds', async ({
  server,
}) => {
  expect(server.fixture.gitActionDeadlineMs).toBe(1500);
});

it('an interrupted action marks the changes until it is dismissed, and dismissing again answers the same', async ({
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
