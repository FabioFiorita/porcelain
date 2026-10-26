import { expect } from 'vitest';
import { threeCommits } from '../kit/reads.ts';
import { worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { list, record, text } from '../kit/session.ts';

test('history preserves literal branch names for short, full and disabled decoration settings', async ({
  session,
}) => {
  const state = await threeCommits(session);
  await session.git('branch', 'refs/heads/topic', 'HEAD');
  for (const decoration of ['short', 'full', 'no']) {
    await session.git('config', 'log.decorate', decoration);
    for (const kind of ['list', 'detail', 'file']) {
      const response = await session.send({
        method: 'GET',
        path: worktreePath(
          session,
          kind === 'list'
            ? '/commits'
            : kind === 'detail'
              ? `/commits/${state.rename}/files`
              : '/file-commits',
        ),
        ...(kind === 'detail'
          ? {}
          : {
              query: {
                limit: 1,
                ...(kind === 'file' ? { path: 'GUIDE.md' } : {}),
              },
            }),
      });
      expect(response.status, `${kind} with ${decoration}`).toBe(200);
      const body = record(response.body);
      const entry = record(
        kind === 'detail' ? body.commit : list(body.commits)[0],
      );
      const commit = kind === 'file' ? record(entry.commit) : entry;
      expect(commit.oid, `${kind} with ${decoration}`).toBe(state.rename);
      expect(
        list(commit.refs).map(text).toSorted(),
        `${kind} with ${decoration}`,
      ).toStrictEqual([session.fixture.branch, 'refs/heads/topic'].toSorted());
    }
  }
});
