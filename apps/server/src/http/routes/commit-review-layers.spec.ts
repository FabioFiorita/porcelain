import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectResponseSchema } from '@porcelain/contracts/inventory';
import { expect, it } from 'vitest';
import { createServer } from '../server.ts';

const token = 'commit-review-fixture-token-at-least-32-characters';
const headers = { authorization: `Bearer ${token}` };

it('preserves ordered subsets for external split commits across live edits, worktree removal, restart and project removal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-commit-layers-'));
  const path = join(root, 'repo');
  const linked = join(root, 'linked');
  const clone = join(root, 'clone');
  const dataDirectory = join(root, 'state');
  const environment = {
    ...process.env,
    HOME: root,
    XDG_CONFIG_HOME: root,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
  };
  const git = (cwd: string, ...args: string[]) =>
    execFileSync('git', ['-C', cwd, ...args], { env: environment })
      .toString()
      .trim();
  const commit = (cwd: string, message: string) => {
    git(cwd, 'add', '.');
    git(
      cwd,
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.invalid',
      'commit',
      '-m',
      message,
    );
    return git(cwd, 'rev-parse', 'HEAD');
  };
  execFileSync('git', ['init', '-b', 'main', path], { env: environment });
  for (const name of ['a.txt', 'b.txt', 'c.txt', 'unassigned.txt'])
    await writeFile(join(path, name), 'before\n');
  commit(path, 'Initial');
  git(path, 'worktree', 'add', '-b', 'review', linked);
  const server = await createServer({ dataDirectory, token });
  try {
    const address = await server.listen({ host: '127.0.0.1', port: 0 });
    async function request(
      route: string,
      method = 'GET',
      body?: unknown,
      status = 200,
    ) {
      const response = await fetch(`${address}${route}`, {
        method,
        headers: {
          ...headers,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      expect(response.status, `${method} ${route}`).toBe(status);
      expect(response.headers.get('cache-control')).toBe('no-store');
      return response.json();
    }
    const project = projectResponseSchema.parse(
      await request('/projects', 'POST', { path }),
    );
    const sourceWorktreeId = project.worktrees.find(
      (worktree) => !worktree.main,
    )?.id;
    if (!sourceWorktreeId) throw new Error('Missing linked worktree');
    const liveUrl = `/worktrees/${sourceWorktreeId}/review-layers`;
    const layers = [
      {
        id: randomUUID(),
        title: 'Second file first',
        files: [{ path: 'b.txt', scope: 'staged' }],
      },
      {
        id: randomUUID(),
        title: 'Core behavior',
        files: [
          { path: 'c.txt', scope: 'unstaged' },
          { path: 'a.txt', scope: 'unstaged' },
        ],
      },
    ];
    const live = await request(liveUrl, 'PUT', { expectedRevision: 0, layers });
    for (const name of ['a.txt', 'c.txt', 'unassigned.txt'])
      await writeFile(join(linked, name), 'first commit\n');
    const firstOid = commit(linked, 'External first part');
    await writeFile(join(linked, 'b.txt'), 'second commit\n');
    const secondOid = commit(linked, 'External second part');
    const firstUrl = `/projects/${project.id}/commits/${firstOid}/review-layers`;
    const secondUrl = `/projects/${project.id}/commits/${secondOid}/review-layers`;
    expect(await request(firstUrl)).toBeNull();
    const firstInput = {
      sourceWorktreeId,
      sourceRevision: 1,
      references: [
        { path: 'a.txt', scope: 'unstaged' },
        { path: 'c.txt', scope: 'unstaged' },
      ],
    };
    expect(
      await request(firstUrl, 'PUT', { ...firstInput, sourceRevision: 2 }, 409),
    ).toMatchObject({ code: 'REVISION_CONFLICT' });
    expect(
      await request(
        firstUrl,
        'PUT',
        { ...firstInput, references: [{ path: 'a.txt', scope: 'staged' }] },
        400,
      ),
    ).toMatchObject({ code: 'INVALID_REQUEST' });
    expect(
      await request(
        firstUrl,
        'PUT',
        { ...firstInput, references: layers[0]?.files },
        400,
      ),
    ).toMatchObject({ code: 'INVALID_REQUEST' });
    expect(await request(firstUrl)).toBeNull();
    const first = await request(firstUrl, 'PUT', firstInput);
    expect(first).toEqual({
      projectId: project.id,
      commitOid: firstOid,
      sourceWorktreeId,
      sourceRevision: 1,
      parentNumber: 1,
      layers: [layers[1]],
    });
    const second = await request(secondUrl, 'PUT', {
      sourceWorktreeId,
      sourceRevision: 1,
      references: layers[0]?.files,
    });
    expect(second).toMatchObject({ layers: [layers[0]] });
    expect(await request(liveUrl)).toEqual(live);
    const inspected = await request(
      `/worktrees/${sourceWorktreeId}/commits/${firstOid}/changes`,
    );
    expect(inspected).toMatchObject({
      changes: expect.arrayContaining([
        expect.objectContaining({ newPath: 'unassigned.txt' }),
      ]),
    });
    execFileSync('git', ['clone', linked, clone], { env: environment });
    const other = projectResponseSchema.parse(
      await request('/projects', 'POST', { path: clone }),
    );
    const otherUrl = `/projects/${other.id}/commits/${firstOid}/review-layers`;
    expect(await request(otherUrl)).toBeNull();
    expect(await request(otherUrl, 'PUT', firstInput, 404)).toMatchObject({
      code: 'WORKTREE_NOT_FOUND',
    });
    await request(liveUrl, 'PUT', { expectedRevision: 1, layers: [] });
    expect(
      await request(firstUrl, 'PUT', {
        ...firstInput,
        references: [...firstInput.references].reverse(),
      }),
    ).toEqual(first);
    expect(
      await request(firstUrl, 'PUT', { ...firstInput, sourceRevision: 2 }, 409),
    ).toMatchObject({ code: 'COMMIT_REVIEW_LAYER_CONFLICT' });
    git(path, 'worktree', 'remove', linked);
    await request('/inventory/refresh', 'POST');
    expect(await request(firstUrl)).toEqual(first);
    expect(await request(firstUrl, 'PUT', firstInput)).toEqual(first);
    await server.close();
    const reopened = await createServer({ dataDirectory, token });
    try {
      for (const [url, expected] of [
        [firstUrl, first],
        [secondUrl, second],
      ] as const) {
        const response = await reopened.inject({ method: 'GET', url, headers });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual(expected);
      }
      expect(
        (
          await reopened.inject({
            method: 'DELETE',
            url: `/projects/${project.id}`,
            headers,
          })
        ).json(),
      ).toEqual({ deleted: true });
      expect(
        (
          await reopened.inject({ method: 'GET', url: firstUrl, headers })
        ).json(),
      ).toMatchObject({ code: 'PROJECT_NOT_FOUND' });
      expect(
        (
          await reopened.inject({ method: 'GET', url: otherUrl, headers })
        ).json(),
      ).toBeNull();
    } finally {
      await reopened.close();
    }
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

it('authenticates before validating association identities and rejects ambiguous path selections', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-commit-layer-errors-'));
  const server = await createServer({ dataDirectory: root, token });
  try {
    const invalid = '/projects/invalid/commits/HEAD/review-layers';
    for (const method of ['GET', 'PUT'] as const) {
      expect((await server.inject({ method, url: invalid })).statusCode).toBe(
        401,
      );
      expect(
        (await server.inject({ method, url: invalid, headers })).statusCode,
      ).toBe(400);
    }
    const url = `/projects/${randomUUID()}/commits/${'a'.repeat(40)}/review-layers`;
    const input = {
      sourceWorktreeId: randomUUID(),
      sourceRevision: 1,
      references: [{ path: 'file', scope: 'staged' }],
    };
    for (const references of [
      [],
      [{ path: '../escape', scope: 'staged' }],
      [...input.references, { path: 'file', scope: 'unstaged' }],
    ]) {
      expect(
        (
          await server.inject({
            method: 'PUT',
            url,
            headers,
            payload: { ...input, references },
          })
        ).statusCode,
      ).toBe(400);
    }
    expect(
      (
        await server.inject({ method: 'PUT', url, headers, payload: input })
      ).json(),
    ).toMatchObject({ code: 'PROJECT_NOT_FOUND' });
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

it('binds review order to the chosen merge parent and uses committed rename and deletion paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-commit-layer-paths-'));
  const path = join(root, 'repo');
  const environment = {
    ...process.env,
    HOME: root,
    XDG_CONFIG_HOME: root,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
  };
  const git = (...args: string[]) =>
    execFileSync(
      'git',
      [
        '-C',
        path,
        '-c',
        'user.name=Fixture',
        '-c',
        'user.email=fixture@example.invalid',
        ...args,
      ],
      { env: environment },
    )
      .toString()
      .trim();
  execFileSync('git', ['init', '-b', 'main', path], { env: environment });
  await writeFile(join(path, 'original.txt'), 'original content\n');
  git('add', '.');
  git('commit', '-m', 'Root');
  const rootOid = git('rev-parse', 'HEAD');
  git('switch', '-c', 'side');
  await writeFile(join(path, 'side.txt'), 'side\n');
  git('add', '.');
  git('commit', '-m', 'Side');
  git('switch', 'main');
  await writeFile(join(path, 'main.txt'), 'main\n');
  git('add', '.');
  git('commit', '-m', 'Main');
  git('merge', '--no-ff', '-m', 'Merge', 'side');
  const mergeOid = git('rev-parse', 'HEAD');
  const server = await createServer({
    dataDirectory: join(root, 'state'),
    token,
  });
  try {
    const project = projectResponseSchema.parse(
      (
        await server.inject({
          method: 'POST',
          url: '/projects',
          headers,
          payload: { path },
        })
      ).json(),
    );
    const sourceWorktreeId = project.worktrees[0]?.id;
    if (!sourceWorktreeId) throw new Error('Missing fixture worktree');
    const layer = {
      id: randomUUID(),
      title: 'Intent',
      files: [
        { path: 'original.txt', scope: 'staged' },
        { path: 'main.txt', scope: 'staged' },
        { path: 'renamed.txt', scope: 'unstaged' },
        { path: 'side.txt', scope: 'unstaged' },
      ],
    };
    const live = await server.inject({
      method: 'PUT',
      url: `/worktrees/${sourceWorktreeId}/review-layers`,
      headers,
      payload: { expectedRevision: 0, layers: [layer] },
    });
    expect(live.statusCode).toBe(200);
    const url = (oid: string) =>
      `/projects/${project.id}/commits/${oid}/review-layers`;
    const associate = (
      oid: string,
      references: typeof layer.files,
      parentNumber = 1,
    ) =>
      server.inject({
        method: 'PUT',
        url: url(oid),
        headers,
        payload: {
          sourceWorktreeId,
          sourceRevision: 1,
          references,
          parentNumber,
        },
      });
    const rootSnapshot = await associate(rootOid, [
      { path: 'original.txt', scope: 'staged' },
    ]);
    expect(rootSnapshot.statusCode).toBe(200);
    expect(rootSnapshot.json()).toMatchObject({
      commitOid: rootOid,
      parentNumber: 1,
    });
    expect(
      (await associate(mergeOid, [{ path: 'main.txt', scope: 'staged' }]))
        .statusCode,
    ).toBe(400);
    const merge = await associate(
      mergeOid,
      [{ path: 'main.txt', scope: 'staged' }],
      2,
    );
    expect(merge.statusCode).toBe(200);
    expect(merge.json()).toMatchObject({
      parentNumber: 2,
      layers: [{ files: [{ path: 'main.txt', scope: 'staged' }] }],
    });
    expect(
      (
        await associate(mergeOid, [{ path: 'side.txt', scope: 'unstaged' }])
      ).json(),
    ).toMatchObject({ code: 'COMMIT_REVIEW_LAYER_CONFLICT' });
    git('mv', 'original.txt', 'renamed.txt');
    git('rm', 'main.txt');
    git('commit', '-m', 'Rename and delete');
    const changedOid = git('rev-parse', 'HEAD');
    expect(
      (await associate(changedOid, [{ path: 'original.txt', scope: 'staged' }]))
        .statusCode,
    ).toBe(400);
    const changed = await associate(changedOid, [
      { path: 'renamed.txt', scope: 'unstaged' },
      { path: 'main.txt', scope: 'staged' },
    ]);
    expect(changed.statusCode).toBe(200);
    expect(changed.json().layers).toEqual([
      {
        ...layer,
        files: [
          { path: 'main.txt', scope: 'staged' },
          { path: 'renamed.txt', scope: 'unstaged' },
        ],
      },
    ]);
    const missingOid = 'f'.repeat(40);
    expect(
      (await associate(missingOid, [{ path: 'original.txt', scope: 'staged' }]))
        .statusCode,
    ).toBe(422);
    expect(
      (
        await server.inject({ method: 'GET', url: url(missingOid), headers })
      ).json(),
    ).toBeNull();
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
