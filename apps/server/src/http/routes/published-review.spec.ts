import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectResponseSchema } from '@porcelain/contracts/inventory';
import { reviewReadResponseSchema } from '@porcelain/contracts/review';
import { expect, it } from 'vitest';
import { pairDevice, pairingReach } from '../helpers/paired-server.ts';
import { createServer } from '../server.ts';

it('atomically publishes the latest review, resolves moved code, and invalidates replaced summary links', async () => {
  const root = await mkdtemp(join(tmpdir(), 'published-review-'));
  const dataDirectory = join(root, 'state');
  const path = join(root, 'repo');
  execFileSync('git', ['init', '-b', 'main', path]);
  await writeFile(
    join(path, 'behavior.ts'),
    'export function behavior() {\n  return 1;\n}\n',
  );
  execFileSync('git', ['-C', path, 'add', 'behavior.ts']);
  execFileSync('git', [
    '-C',
    path,
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.test',
    'commit',
    '-m',
    'base',
  ]);
  await writeFile(
    join(path, 'behavior.ts'),
    'export function behavior() {\n  return 2;\n}\n',
  );
  await writeFile(
    join(path, 'unexplained.ts'),
    'export const unexplained = 1;\n',
  );
  const server = await createServer({
    pairingReach,
    dataDirectory,
    projectHome: dataDirectory,
  });
  const headers = await pairDevice(server, server.application);
  try {
    const registered = await server.inject({
      method: 'POST',
      url: '/api/projects',
      headers,
      payload: { path },
    });
    const worktreeId = projectResponseSchema.parse(registered.json())
      .worktrees[0]?.id;
    const url = `/api/worktrees/${worktreeId}/review`;
    expect(
      (await server.inject({ method: 'GET', url, headers })).json(),
    ).toEqual({ review: null });
    const layerId = randomUUID();
    const stepId = randomUUID();
    const input = {
      expectedRevision: 0,
      summaryHtml:
        '<!doctype html><title>Review</title><a href="#layer-1">Open</a>',
      layers: [
        {
          id: layerId,
          title: 'Behavior changes',
          summary: 'The behavior now returns the new value.',
          lanes: ['Domain'],
          steps: [
            {
              id: stepId,
              lane: 0,
              title: 'behavior',
              text: 'Returns the updated value.',
              kind: 'changed' as const,
              pointer: {
                path: 'behavior.ts',
                startLine: 1,
                endLine: 3,
                symbol: 'behavior',
              },
            },
          ],
        },
      ],
    };
    const published = reviewReadResponseSchema.parse(
      (
        await server.inject({ method: 'PUT', url, headers, payload: input })
      ).json(),
    ).review;
    expect(published).toMatchObject({
      revision: 1,
      active: true,
      diagnostics: 'current',
    });
    expect(published?.layers[0]?.steps[0]).toMatchObject({
      location: { state: 'current', startLine: 1, endLine: 3 },
    });
    expect(published?.notExplained).toEqual([
      {
        path: 'unexplained.ts',
        ranges: [{ startLine: 1, endLine: 1 }],
      },
    ]);
    const oldSummary = published?.summary.url;
    expect(oldSummary).toBeTruthy();
    const summary = await server.inject({
      method: 'GET',
      url: oldSummary ?? '',
    });
    expect(summary.statusCode).toBe(200);
    expect(summary.headers['content-security-policy']).toContain(
      'sandbox allow-scripts',
    );
    expect(summary.body).toContain('porcelain-summary');
    expect(summary.body).toContain(':root[data-theme=dark]');
    const expired = new URL(oldSummary ?? '', 'http://fixture');
    expired.searchParams.set('expires', '1');
    expect(
      (
        await server.inject({
          method: 'GET',
          url: `${expired.pathname}${expired.search}`,
        })
      ).statusCode,
    ).toBe(404);

    const conflict = await server.inject({
      method: 'PUT',
      url,
      headers,
      payload: input,
    });
    expect(conflict.statusCode).toBe(409);
    await writeFile(
      join(path, 'behavior.ts'),
      '\nexport function behavior() {\n  return 2;\n}\n',
    );
    const moved = reviewReadResponseSchema.parse(
      (await server.inject({ method: 'GET', url, headers })).json(),
    ).review;
    expect(moved?.layers[0]?.steps[0]?.location).toEqual({
      state: 'current',
      startLine: 2,
      endLine: 4,
    });
    const replaced = await server.inject({
      method: 'PUT',
      url,
      headers,
      payload: {
        ...input,
        expectedRevision: 1,
        layers: [
          {
            ...input.layers[0],
            steps: [
              {
                ...input.layers[0]?.steps[0],
                pointer: {
                  path: 'behavior.ts',
                  startLine: 2,
                  endLine: 4,
                  symbol: 'behavior',
                },
              },
            ],
          },
        ],
      },
    });
    expect(replaced.statusCode).toBe(200);
    expect(
      (await server.inject({ method: 'GET', url: oldSummary ?? '' }))
        .statusCode,
    ).toBe(404);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
