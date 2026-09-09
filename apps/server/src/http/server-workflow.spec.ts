import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { artifactMetadataSchema } from '@porcelain/contracts/artifacts';
import {
  inventoryResponseSchema,
  projectResponseSchema,
} from '@porcelain/contracts/inventory';
import { expect, it } from 'vitest';
import { createServer } from './server.ts';

it('keeps review metadata together across Git inspection, refresh and a server restart', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-workflow-'));
  const path = join(root, 'repo');
  const dataDirectory = join(root, 'state');
  const token = 'disposable-workflow-token-at-least-32-characters';
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
  const server = await createServer({ dataDirectory, token });
  try {
    const address = await server.listen({ host: '127.0.0.1', port: 0 });
    async function request(url: string, method = 'GET', body?: unknown) {
      const response = await fetch(`${address}${url}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      expect(response.ok, `${method} ${url}: ${response.status}`).toBe(true);
      return response.json();
    }
    const project = projectResponseSchema.parse(
      await request('/projects', 'POST', { path }),
    );
    const inventory = inventoryResponseSchema.parse(
      await request('/inventory'),
    );
    expect(inventory.projects).toEqual([project]);
    const worktreeId = project.worktrees.find((worktree) => !worktree.main)?.id;
    expect(worktreeId).toBeDefined();
    const base = `/worktrees/${worktreeId}`;
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
      `/projects/${project.id}/file-preferences`,
      'PUT',
      {
        path: 'notes.txt',
        flag: 'pinned',
        value: true,
      },
    );
    // Registering through either checkout resolves to the same project preferences.
    const linkedProject = projectResponseSchema.parse(
      await request('/projects', 'POST', { path: linked }),
    );
    expect(linkedProject.id).toBe(project.id);
    expect(
      await request(`/projects/${linkedProject.id}/file-preferences`),
    ).toEqual(preferences);
    const layers = await request(`${base}/review-layers`, 'PUT', {
      expectedRevision: 0,
      layers: [
        {
          id: randomUUID(),
          title: 'Review',
          files: [{ path: 'notes.txt', scope: 'unstaged' }],
        },
      ],
    });
    const comments = await request(`${base}/comments`, 'POST', {
      anchor: { kind: 'file', filePath: 'notes.txt' },
      body: 'Explain this change',
    });
    const artifact = artifactMetadataSchema.parse(
      await request(`${base}/artifacts`, 'POST', {
        name: 'Explanation',
        content: '<h1>Review</h1>',
      }),
    );
    await request('/inventory/refresh', 'POST');
    await server.close();
    const restarted = await createServer({ dataDirectory, token });
    try {
      const headers = { authorization: `Bearer ${token}` };
      const restored = await restarted.inject({
        method: 'GET',
        url: '/inventory',
        headers,
      });
      expect(restored.statusCode).toBe(200);
      expect(inventoryResponseSchema.parse(restored.json())).toEqual(inventory);
      for (const [suffix, expected] of [
        ['file-preferences', preferences],
        ['review-layers', layers],
        ['comments', comments],
      ] as const) {
        const response = await restarted.inject({
          method: 'GET',
          url:
            suffix === 'file-preferences'
              ? `/projects/${project.id}/${suffix}`
              : `${base}/${suffix}`,
          headers,
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual(expected);
      }
      const stored = await restarted.inject({
        method: 'GET',
        url: `${base}/artifacts/${artifact.id}`,
        headers,
      });
      expect(stored.statusCode).toBe(200);
      expect(stored.json()).toMatchObject({ content: '<h1>Review</h1>' });
    } finally {
      await restarted.close();
    }
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
