import { expect } from 'vitest';
import { threeCommits } from '../kit/reads.ts';
import { worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { list, record } from '../kit/session.ts';

test('history keeps a tag named like the current branch distinct from local, remote and HEAD refs', async ({
  session,
}) => {
  const state = await threeCommits(session);
  await session.git('tag', session.fixture.branch, state.second);
  await session.git('tag', '-a', 'release', '-m', 'Release', state.second);
  await session.git('branch', 'origin/main', state.second);
  await session.git('tag', 'origin/main', state.second);
  await session.git(
    'update-ref',
    'refs/porcelain/reviews/internal/1',
    state.second,
  );
  await session.git('update-ref', 'refs/remotes/origin/main', state.second);
  for (const kind of ['list', 'detail', 'file']) {
    const response = await session.send({
      method: 'GET',
      path: worktreePath(
        session,
        kind === 'list'
          ? '/commits'
          : kind === 'detail'
            ? `/commits/${state.second}/files`
            : '/file-commits',
      ),
      ...(kind === 'file' ? { query: { path: 'GUIDE.md' } } : {}),
    });
    expect(response.status, kind).toBe(200);
    const body = record(response.body);
    const entries = kind === 'detail' ? [body.commit] : list(body.commits);
    const commits = entries.map((entry) => {
      const value = record(entry);
      return kind === 'file' ? record(value.commit) : value;
    });
    expect(
      commits.find((commit) => commit.oid === state.second)?.refs,
      kind,
    ).toEqual(
      expect.arrayContaining([
        { kind: 'tag', name: session.fixture.branch },
        { kind: 'tag', name: 'release' },
        { kind: 'tag', name: 'origin/main' },
        { kind: 'local-branch', name: 'origin/main' },
        { kind: 'remote-branch', name: 'origin/main' },
      ]),
    );
    expect(
      list(commits.find((commit) => commit.oid === state.second)?.refs),
    ).toHaveLength(5);
    if (kind === 'list')
      expect(
        commits.find((commit) => commit.oid === state.rename)?.refs,
      ).toEqual(
        expect.arrayContaining([
          { kind: 'head', name: 'HEAD' },
          { kind: 'local-branch', name: session.fixture.branch },
        ]),
      );
  }
  await session.git('switch', '--detach', state.second);
  const detached = await session.send({
    method: 'GET',
    path: worktreePath(session, '/commits'),
  });
  expect(detached.status).toBe(200);
  expect(record(detached.body).snapshot).toEqual({
    tipOid: state.second,
    head: { kind: 'detached' },
  });
  expect(record(list(record(detached.body).commits)[0]).refs).toEqual(
    expect.arrayContaining([{ kind: 'head', name: 'HEAD' }]),
  );
});
