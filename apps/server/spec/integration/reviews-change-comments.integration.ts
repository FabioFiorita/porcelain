import { expect } from 'vitest';
import { invalidRequest } from '../kit/answers.ts';
import { head } from '../kit/reads.ts';
import { worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { list, type HttpResponse } from '../kit/session.ts';

const BASE = 'refs/heads/main';

test('a whole-change comment that names a file, compares against anything but a branch, or omits the branch tip is refused and nothing is written', async ({
  session,
}) => {
  const tip = await head(session);
  const responses: HttpResponse[] = [];

  for (const anchor of [
    { kind: 'change', filePath: 'README.md' },
    { kind: 'change', comparison: { kind: 'worktree', scope: 'staged' } },
    {
      kind: 'change',
      comparison: { kind: 'commit', parent: 1 },
      revision: tip,
    },
    { kind: 'change', comparison: { kind: 'branch', base: BASE } },
  ])
    responses.push(
      await session.send({
        method: 'POST',
        path: worktreePath(session, '/comments'),
        body: { anchor, body: 'Refused' },
      }),
    );

  expect(responses.map((entry) => entry.status)).toStrictEqual([
    400, 400, 400, 400,
  ]);
  for (const response of responses)
    expect(response.body).toStrictEqual(invalidRequest);
  expect(
    list(
      (
        await session.read({
          method: 'GET',
          path: worktreePath(session, '/comments'),
        })
      ).body,
    ),
  ).toHaveLength(3);
});
