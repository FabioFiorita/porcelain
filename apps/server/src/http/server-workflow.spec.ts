import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  inventoryResponseSchema,
  projectResponseSchema,
} from '@porcelain/contracts/inventory';
import { reviewReadResponseSchema } from '@porcelain/contracts/review';
import { expect, it } from 'vitest';
import { pairDevice, pairingReach } from './helpers/paired-server.ts';
import { createServer } from './server.ts';

it('keeps review metadata together across Git inspection, refresh and a server restart', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-workflow-'));
  const path = join(root, 'repo');
  const dataDirectory = join(root, 'state');
  execFileSync('git', ['init', '-b', 'main', path]);
  await writeFile(join(path, 'notes.txt'), 'before\n');
  execFileSync('git', ['-C', path, 'add', '.']);
  execFileSync('git', [
    '-C',
    path,
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '-m',
    'Initial',
  ]);
  const linked = join(root, 'linked');
  execFileSync('git', ['-C', path, 'worktree', 'add', '-b', 'review', linked]);
  await writeFile(join(linked, 'notes.txt'), 'after\n');
  const server = await createServer({
    pairingReach,
    dataDirectory,
    projectHome: dataDirectory,
  });
  const headers = await pairDevice(server, server.application);
  await server.refreshed();
  try {
    const address = await server.listen({ host: '127.0.0.1', port: 0 });
    async function request(url: string, method = 'GET', body?: unknown) {
      const response = await fetch(`${address}${url}`, {
        method,
        headers: {
          ...headers,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      expect(response.ok, `${method} ${url}: ${response.status}`).toBe(true);
      return response.json();
    }
    const project = projectResponseSchema.parse(
      await request('/api/projects', 'POST', { path }),
    );
    const inventory = inventoryResponseSchema.parse(
      await request('/api/inventory'),
    );
    expect(inventory.projects).toEqual([project]);
    const worktreeId = project.worktrees.find((worktree) => !worktree.main)?.id;
    expect(worktreeId).toBeDefined();
    const base = `/api/worktrees/${worktreeId}`;
    expect(await request(`${base}/directory?path=`)).toMatchObject({
      entries: expect.arrayContaining([
        expect.objectContaining({ name: 'notes.txt' }),
      ]),
    });
    expect(await request(`${base}/text?path=notes.txt`)).toMatchObject({
      text: 'after\n',
    });
    expect(await request(`${base}/git/status`)).toMatchObject({
      changes: [
        expect.objectContaining({ newPath: 'notes.txt', scope: 'unstaged' }),
      ],
    });
    expect(await request(`${base}/commits`)).toMatchObject({
      commits: [expect.objectContaining({ subject: 'Initial' })],
    });
    const preferences = await request(
      `/api/projects/${project.id}/file-preferences`,
      'PUT',
      {
        path: 'notes.txt',
        flag: 'pinned',
        value: true,
      },
    );
    // Registering through either checkout resolves to the same project preferences.
    const linkedProject = projectResponseSchema.parse(
      await request('/api/projects', 'POST', { path: linked }),
    );
    expect(linkedProject.id).toBe(project.id);
    expect(
      await request(`/api/projects/${linkedProject.id}/file-preferences`),
    ).toEqual(preferences);
    const review = await request(`${base}/review`, 'PUT', {
      expectedRevision: 0,
      summaryHtml: '<!doctype html><title>Review</title>',
      layers: [
        {
          id: randomUUID(),
          title: 'Review',
          summary: 'Review notes.',
          lanes: ['Code'],
          steps: [
            {
              id: randomUUID(),
              lane: 0,
              title: 'Notes',
              text: 'The notes changed.',
              kind: 'changed',
              pointer: { path: 'notes.txt', startLine: 1, endLine: 1 },
            },
          ],
        },
      ],
    });
    const comments = await request(`${base}/comments`, 'POST', {
      anchor: { kind: 'file', filePath: 'notes.txt' },
      body: 'Explain this change',
    });
    const before = inventoryResponseSchema.parse(
      await request('/api/inventory'),
    );
    // Layers were published above, so the sidebar's dot is part of what has
    // to survive the restart.
    expect(
      before.projects[0]?.worktrees.map((worktree) => worktree.status),
    ).toContain('pending');
    await server.close();
    const restarted = await createServer({
      pairingReach,
      dataDirectory,
      projectHome: dataDirectory,
    });
    await restarted.refreshed();
    try {
      const restored = await restarted.inject({
        method: 'GET',
        url: '/api/inventory',
        headers,
      });
      expect(restored.statusCode).toBe(200);
      expect(inventoryResponseSchema.parse(restored.json())).toEqual(before);
      for (const [suffix, expected] of [
        ['file-preferences', preferences],
        ['review', review],
        ['comments', comments],
      ] as const) {
        const response = await restarted.inject({
          method: 'GET',
          url:
            suffix === 'file-preferences'
              ? `/api/projects/${project.id}/${suffix}`
              : `${base}/${suffix}`,
          headers,
        });
        expect(response.statusCode).toBe(200);
        const actual = response.json();
        if (suffix === 'review') {
          // A read renews the capability expiry; the stored publication is unchanged.
          expect(actual.review.summary.url).toMatch(/^\/review-summaries\//);
          const saved = reviewReadResponseSchema.parse(expected).review;
          expect(saved).not.toBeNull();
          actual.review.summary.url = saved?.summary.url;
        }
        expect(actual).toEqual(expected);
      }
    } finally {
      await restarted.close();
    }
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
