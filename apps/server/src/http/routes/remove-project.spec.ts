import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  inventoryResponseSchema,
  projectResponseSchema,
} from '@porcelain/contracts/inventory';
import { describe, expect, it } from 'vitest';
import { createServer } from '../server.ts';

const token = 'fixture-project-removal-token-at-least-32-characters';
const headers = { authorization: `Bearer ${token}` };

describe('Project removal HTTP workflow', () => {
  it('erases current and disappeared worktree data, preserves other projects and leaves Git untouched across restart', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-remove-http-'));
    const environment = {
      ...process.env,
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
    };
    const git = (path: string, args: string[]) =>
      execFileSync('git', ['-C', path, ...args], { env: environment });
    const path = join(root, 'project');
    const otherPath = join(root, 'other');
    const linked = join(root, 'linked');
    const dataDirectory = join(root, 'state');
    const server = await createServer({ dataDirectory, token });
    try {
      execFileSync('git', ['init', '-b', 'main', path], { env: environment });
      execFileSync('git', ['init', '-b', 'main', otherPath], {
        env: environment,
      });
      await writeFile(join(path, 'notes.txt'), 'original\n');
      git(path, ['add', 'notes.txt']);
      git(path, [
        '-c',
        'user.name=Fixture',
        '-c',
        'user.email=fixture@example.invalid',
        'commit',
        '-m',
        'Initial',
      ]);
      git(path, ['worktree', 'add', '-b', 'review', linked]);
      await writeFile(join(path, 'notes.txt'), 'uncommitted\n');
      const address = await server.listen({ host: '127.0.0.1', port: 0 });
      async function request(route: string, method = 'GET', body?: unknown) {
        const response = await fetch(`${address}${route}`, {
          method,
          headers: {
            ...headers,
            ...(body === undefined
              ? {}
              : { 'content-type': 'application/json' }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        expect(response.ok, `${method} ${route}: ${response.status}`).toBe(
          true,
        );
        return response.json();
      }
      const project = projectResponseSchema.parse(
        await request('/projects', 'POST', { path }),
      );
      const other = projectResponseSchema.parse(
        await request('/projects', 'POST', { path: otherPath }),
      );
      const initial = inventoryResponseSchema.parse(
        await request('/inventory'),
      );
      for (const worktree of [...project.worktrees, ...other.worktrees]) {
        const base = `/worktrees/${worktree.id}`;
        await request(`${base}/review-layers`, 'PUT', {
          expectedRevision: 0,
          layers: [
            {
              id: randomUUID(),
              title: 'Review',
              files: [{ path: 'notes.txt', scope: 'unstaged' }],
            },
          ],
        });
        await request(`${base}/comments`, 'POST', {
          anchor: { kind: 'file', filePath: 'notes.txt' },
          body: 'Review this',
        });
        await request(`${base}/artifacts`, 'POST', {
          name: 'Review',
          content: '<h1>Review</h1>',
        });
      }
      for (const owner of [project, other]) {
        await request(`/projects/${owner.id}/file-preferences`, 'PUT', {
          path: 'notes.txt',
          flag: 'pinned',
          value: true,
        });
      }
      // External worktree removal must not make its retained data escape project deletion.
      git(path, ['worktree', 'remove', linked]);
      await request('/inventory/refresh', 'POST');
      expect(await request(`/projects/${project.id}/file-preferences`)).toEqual(
        { preferences: [{ path: 'notes.txt', pinned: true, hidden: false }] },
      );
      const head = git(path, ['rev-parse', 'HEAD']);
      const index = await readFile(join(path, '.git', 'index'));
      const worktrees = git(path, ['worktree', 'list', '--porcelain']);
      const db = new DatabaseSync(join(dataDirectory, 'inventory.sqlite'));
      try {
        const receipt = {
          requestId: randomUUID(),
          preparationId: randomUUID(),
          projectId: project.id,
          worktreeId: project.worktrees[0]?.id,
          action: 'commit',
          state: 'succeeded',
          refreshRequired: true,
          acceptedAt: 1,
        };
        db.prepare('INSERT INTO git_action_receipts VALUES (?, ?)').run(
          receipt.requestId,
          JSON.stringify(receipt),
        );
        db.prepare('INSERT INTO git_action_preparations VALUES (?, ?, ?)').run(
          receipt.preparationId,
          JSON.stringify({ projectId: project.id }),
          1,
        );
        expect(await request(`/projects/${project.id}`, 'DELETE')).toEqual({
          deleted: true,
        });
        expect(await request(`/projects/${project.id}`, 'DELETE')).toEqual({
          deleted: false,
        });
        expect(await request('/inventory')).toEqual({
          ...initial,
          projects: [other],
        });
        for (const table of [
          'review_layer_sets',
          'comment_threads',
          'artifacts',
          'project_worktrees',
        ]) {
          expect(db.prepare(`SELECT worktree_id FROM ${table}`).all()).toEqual([
            { worktree_id: other.worktrees[0]?.id },
          ]);
        }
        expect(
          db.prepare('SELECT project_id FROM project_file_preferences').all(),
        ).toEqual([{ project_id: other.id }]);
        expect(db.prepare('SELECT * FROM git_action_receipts').all()).toEqual(
          [],
        );
        expect(
          db.prepare('SELECT * FROM git_action_preparations').all(),
        ).toEqual([]);
        expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      } finally {
        db.close();
      }
      expect(git(path, ['rev-parse', 'HEAD'])).toEqual(head);
      expect(git(path, ['worktree', 'list', '--porcelain'])).toEqual(worktrees);
      expect(await readFile(join(path, '.git', 'index'))).toEqual(index);
      expect(await readFile(join(path, 'notes.txt'), 'utf8')).toBe(
        'uncommitted\n',
      );
      await server.close();
      const restarted = await createServer({ dataDirectory, token });
      try {
        expect(
          (
            await restarted.inject({
              method: 'GET',
              url: '/inventory',
              headers,
            })
          ).json(),
        ).toEqual({ ...initial, projects: [other] });
        const registered = projectResponseSchema.parse(
          (
            await restarted.inject({
              method: 'POST',
              url: '/projects',
              headers,
              payload: { path },
            })
          ).json(),
        );
        expect(registered.id).not.toBe(project.id);
        const base = `/worktrees/${registered.worktrees[0]?.id}`;
        for (const [suffix, expected] of [
          ['comments', []],
          ['artifacts', []],
          ['file-preferences', { preferences: [] }],
        ] as const)
          expect(
            (
              await restarted.inject({
                method: 'GET',
                url:
                  suffix === 'file-preferences'
                    ? `/projects/${registered.id}/${suffix}`
                    : `${base}/${suffix}`,
                headers,
              })
            ).json(),
          ).toEqual(expected);
        expect(
          (
            await restarted.inject({
              method: 'GET',
              url: `${base}/review-layers`,
              headers,
            })
          ).json(),
        ).toMatchObject({ revision: 0, layers: [] });
      } finally {
        await restarted.close();
      }
    } finally {
      await server.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('authenticates before validation and rejects removal of a recovery-blocked project', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-remove-errors-'));
    const server = await createServer({ dataDirectory: root, token });
    try {
      expect(
        (await server.inject({ method: 'DELETE', url: '/projects/invalid' }))
          .statusCode,
      ).toBe(401);
      expect(
        (
          await server.inject({
            method: 'DELETE',
            url: '/projects/invalid',
            headers,
          })
        ).statusCode,
      ).toBe(400);
      const path = join(root, 'repo');
      execFileSync('git', ['init', path]);
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
      const db = new DatabaseSync(join(root, 'inventory.sqlite'));
      try {
        db.prepare('INSERT INTO git_action_blocks VALUES (?)').run(project.id);
      } finally {
        db.close();
      }
      const response = await server.inject({
        method: 'DELETE',
        url: `/projects/${project.id}`,
        headers,
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        code: 'PROJECT_REMOVAL_BLOCKED',
      });
      expect(response.headers['cache-control']).toBe('no-store');
      expect(
        (
          await server.inject({ method: 'GET', url: '/inventory', headers })
        ).json().projects,
      ).toEqual([project]);
    } finally {
      await server.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
