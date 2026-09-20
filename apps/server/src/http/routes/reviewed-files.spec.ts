import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evidenceResponseSchema } from '@porcelain/contracts/evidence';
import { projectResponseSchema } from '@porcelain/contracts/inventory';
import { reviewedMarksResponseSchema } from '@porcelain/contracts/reviewed-files';
import type { GitStatusObservation } from '@porcelain/git/dtos/git-status';
import { expect, it } from 'vitest';
import { createServer } from '../server.ts';

const token = 'fixture-reviewed-files-token-at-least-32-characters';
const headers = { authorization: `Bearer ${token}` };

it('serves exact evidence, persists worktree marks, rejects stale fingerprints, and removes idempotently', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-reviewed-http-'));
  const checkout = join(root, 'checkout');
  await mkdir(checkout);
  const gitEnvironment = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_AUTHOR_NAME: 'Fixture',
    GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'Fixture',
    GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
  };
  const git = (args: string[]) =>
    execFileSync('git', ['-C', checkout, ...args], {
      env: gitEnvironment,
      encoding: 'utf8',
    });
  execFileSync('git', ['init', '-b', 'main', checkout], {
    env: gitEnvironment,
    stdio: 'ignore',
  });
  await writeFile(join(checkout, 'file.ts'), 'before\n');
  git(['add', 'file.ts']);
  git(['commit', '-m', 'Initial']);

  const observation: GitStatusObservation = {
    statusToken: 'a'.repeat(64),
    headOid: git(['rev-parse', 'HEAD']).trim(),
    changes: [
      {
        scope: 'unstaged',
        kind: 'modified',
        oldPath: 'file.ts',
        newPath: 'file.ts',
        oldMode: '100644',
        newMode: '100644',
        supported: true,
      },
    ],
  };
  const server = await createServer({
    dataDirectory: join(root, 'state'),
    projectHome: join(root, 'state'),
    token,
    inspectionGit: () => ({
      readStatus: async () => observation,
      readDiff: async () => ({
        kind: 'text',
        patch: '@@ -1 +1 @@\n-before\n+after\n',
      }),
      readDiffs: async (changes) =>
        changes.map(() => ({
          kind: 'text',
          patch: '@@ -1 +1 @@\n-before\n+after\n',
        })),
    }),
  });
  try {
    const registered = projectResponseSchema.parse(
      (
        await server.inject({
          method: 'POST',
          url: '/api/projects',
          headers,
          payload: { path: checkout },
        })
      ).json(),
    );
    const worktreeId = registered.worktrees[0]?.id;
    if (!worktreeId) throw new Error('Expected registered worktree');
    const base = `/api/worktrees/${worktreeId}`;

    const evidenceResponse = await server.inject({
      method: 'GET',
      url: `${base}/evidence`,
      headers,
    });
    expect(evidenceResponse.statusCode).toBe(200);
    const evidence = evidenceResponseSchema.parse(evidenceResponse.json());
    expect(evidence.evidence).toHaveLength(1);
    expect(evidence.evidence[0]).toMatchObject({
      path: 'file.ts',
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      comparisons: [
        {
          change: observation.changes[0],
          content: {
            kind: 'diff',
            content: { kind: 'text', patch: '@@ -1 +1 @@\n-before\n+after\n' },
          },
        },
      ],
    });
    const fingerprint = evidence.evidence[0]?.fingerprint;
    if (!fingerprint) throw new Error('Expected a fingerprint');

    expect(
      (
        await server.inject({
          method: 'PUT',
          url: `${base}/reviewed`,
          headers,
          payload: { path: 'file.ts', reviewed: false, fingerprint },
        })
      ).statusCode,
    ).toBe(400);

    const mark = await server.inject({
      method: 'PUT',
      url: `${base}/reviewed`,
      headers,
      payload: { path: 'file.ts', reviewed: true, fingerprint },
    });
    expect(mark.statusCode).toBe(200);
    expect(reviewedMarksResponseSchema.parse(mark.json())).toMatchObject({
      worktreeId,
      marks: [{ path: 'file.ts', fingerprint }],
    });

    const stale = await server.inject({
      method: 'PUT',
      url: `${base}/reviewed`,
      headers,
      payload: { path: 'file.ts', reviewed: true, fingerprint: 'b'.repeat(64) },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toEqual({
      code: 'REVIEWED_MARK_STALE',
      message: 'The reviewed mark is based on stale evidence',
    });
    expect(
      reviewedMarksResponseSchema.parse(
        (
          await server.inject({
            method: 'GET',
            url: `${base}/reviewed`,
            headers,
          })
        ).json(),
      ).marks,
    ).toEqual([
      { path: 'file.ts', fingerprint, reviewedAt: expect.any(String) },
    ]);

    const removed = await server.inject({
      method: 'DELETE',
      url: `${base}/reviewed?path=file.ts`,
      headers,
    });
    expect(removed.statusCode).toBe(200);
    expect(removed.json()).toEqual({ worktreeId, marks: [] });
    const removedAgain = await server.inject({
      method: 'DELETE',
      url: `${base}/reviewed?path=file.ts`,
      headers,
    });
    expect(removedAgain.statusCode).toBe(200);
    expect(removedAgain.json()).toEqual({ worktreeId, marks: [] });
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
