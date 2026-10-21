import { markCommentsSeenResponseSchema } from '@porcelain/contracts/reviews';
import * as Schema from 'effect/Schema';
import { expect } from 'vitest';
import { worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { type HttpRequest, type Session } from '../kit/session.ts';

const seen = (session: Session, throughRevision: unknown): HttpRequest => ({
  method: 'POST',
  path: worktreePath(session, '/comments/seen'),
  body: { throughRevision },
});

async function twoThreads(session: Session) {
  for (const body of ['First', 'Second'])
    await session.read({
      method: 'POST',
      path: worktreePath(session, '/comments'),
      body: { anchor: { kind: 'file', filePath: 'README.md' }, body },
    });
}

test('marking comments seen through an existing revision records that revision', async ({
  session,
}) => {
  await twoThreads(session);

  const response = await session.send(seen(session, 1));

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(markCommentsSeenResponseSchema),
      ),
    ),
  );
  expect(response.body).toStrictEqual({
    worktreeId: session.worktreeId,
    seenThrough: 1,
  });
});
