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
import { pairDevice, pairingReach } from '../helpers/paired-server.ts';

import { createServer } from '../server.ts';

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
    const server = await createServer({
      pairingReach,
      dataDirectory,
      projectHome: dataDirectory,
    });
    const headers = await pairDevice(server, server.application);
    await server.refreshed();
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
        await request('/api/projects', 'POST', { path }),
      );
      const other = projectResponseSchema.parse(
        await request('/api/projects', 'POST', { path: otherPath }),
      );
      const initial = inventoryResponseSchema.parse(
        await request('/api/inventory'),
      );
      for (const worktree of [...project.worktrees, ...other.worktrees]) {
        const base = `/api/worktrees/${worktree.id}`;
        await request(`${base}/review`, 'PUT', {
          expectedRevision: 0,
          summaryHtml: '<title>Review</title>',
          layers: [
            {
              id: randomUUID(),
              title: 'Review',
              summary: 'Review the current changes.',
              lanes: ['Code'],
              steps: [
                {
                  id: randomUUID(),
                  lane: 0,
                  title: 'Notes',
                  text: 'Review the project notes.',
                  kind: 'context',
                  pointer: { path: 'notes.txt', startLine: 1, endLine: 1 },
                },
              ],
            },
          ],
        });
        await request(`${base}/comments`, 'POST', {
          anchor: { kind: 'file', filePath: 'notes.txt' },
          body: 'Review this',
        });
      }
      for (const owner of [project, other]) {
        await request(`/api/projects/${owner.id}/file-preferences`, 'PUT', {
          path: 'notes.txt',
          flag: 'pinned',
          value: true,
        });
      }
      // External worktree removal must not make its retained data escape project deletion.
      git(path, ['worktree', 'remove', linked]);
      await request('/api/inventory');
      expect(
        await request(`/api/projects/${project.id}/file-preferences`),
      ).toEqual({
        preferences: [{ path: 'notes.txt', pinned: true, hidden: false }],
      });
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
        expect(await request(`/api/projects/${project.id}`, 'DELETE')).toEqual({
          deleted: true,
        });
        expect(await request(`/api/projects/${project.id}`, 'DELETE')).toEqual({
          deleted: false,
        });
        expect(await request('/api/inventory')).toEqual({
          ...initial,
          // The remaining project kept its review data, so it kept its dot.
          projects: [
            {
              ...other,
              worktrees: other.worktrees.map((worktree) => ({
                ...worktree,
                status: 'pending',
              })),
            },
          ],
        });
        for (const table of [
          'reviews',
          'comment_threads',
          // Presence is what ties review data to a project now.
          'worktree_presence',
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
      const restarted = await createServer({
        pairingReach,
        dataDirectory,
        projectHome: dataDirectory,
      });
      await restarted.refreshed();
      try {
        expect(
          (
            await restarted.inject({
              method: 'GET',
              url: '/api/inventory',
              headers,
            })
          ).json(),
        ).toEqual({
          ...initial,
          projects: [
            {
              ...other,
              worktrees: other.worktrees.map((worktree) => ({
                ...worktree,
                status: 'pending',
              })),
            },
          ],
        });
        const registered = projectResponseSchema.parse(
          (
            await restarted.inject({
              method: 'POST',
              url: '/api/projects',
              headers,
              payload: { path },
            })
          ).json(),
        );
        expect(registered.id).not.toBe(project.id);
        const base = `/api/worktrees/${registered.worktrees[0]?.id}`;
        for (const [suffix, expected] of [
          ['comments', []],
          ['file-preferences', { preferences: [] }],
        ] as const)
          expect(
            (
              await restarted.inject({
                method: 'GET',
                url:
                  suffix === 'file-preferences'
                    ? `/api/projects/${registered.id}/${suffix}`
                    : `${base}/${suffix}`,
                headers,
              })
            ).json(),
          ).toEqual(expected);
        expect(
          (
            await restarted.inject({
              method: 'GET',
              url: `${base}/review`,
              headers,
            })
          ).json(),
        ).toEqual({ review: null });
      } finally {
        await restarted.close();
      }
    } finally {
      await server.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("answers not found for a removed project's worktree, whose checkout is still on disk", async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-remove-stale-'));
    const server = await createServer({
      pairingReach,
      dataDirectory: root,
      projectHome: root,
    });
    const headers = await pairDevice(server, server.application);
    await server.refreshed();
    try {
      const path = join(root, 'repo');
      execFileSync('git', ['init', '-b', 'main', path]);
      const project = projectResponseSchema.parse(
        (
          await server.inject({
            method: 'POST',
            url: '/api/projects',
            headers,
            payload: { path },
          })
        ).json(),
      );
      const worktree = project.worktrees[0]?.id;
      // Removal deletes rows; it does not touch Git, so the checkout and its
      // administrative directory still answer everything the resolver asks.
      expect(
        (
          await server.inject({
            method: 'DELETE',
            url: `/api/projects/${project.id}`,
            headers,
          })
        ).json(),
      ).toEqual({ deleted: true });
      const written = await server.inject({
        method: 'POST',
        url: `/api/worktrees/${worktree}/comments`,
        headers,
        payload: {
          anchor: { kind: 'file', filePath: 'notes.txt' },
          body: 'Is anyone there?',
        },
      });
      expect(written.statusCode).toBe(404);
      expect(
        (
          await server.inject({
            method: 'GET',
            url: `/api/worktrees/${worktree}/comments`,
            headers,
          })
        ).statusCode,
      ).toBe(404);
    } finally {
      await server.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('renames a project, refuses an unusable name, and 404s an unknown one', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-rename-http-'));
    const server = await createServer({
      pairingReach,
      dataDirectory: root,
      projectHome: root,
    });
    const headers = await pairDevice(server, server.application);
    await server.refreshed();
    try {
      const path = join(root, 'checked-out-here');
      execFileSync('git', ['init', '-b', 'main', path]);
      const project = projectResponseSchema.parse(
        (
          await server.inject({
            method: 'POST',
            url: '/api/projects',
            headers,
            payload: { path },
          })
        ).json(),
      );
      const rename = (payload: Record<string, unknown>, id = project.id) =>
        server.inject({
          method: 'PATCH',
          url: `/api/projects/${id}`,
          headers,
          payload,
        });
      const renamed = await rename({ name: '  Atlas review  ' });
      expect(renamed.statusCode, renamed.body).toBe(200);
      // Trimmed on the way in, and the name is all the reply carries.
      expect(renamed.json()).toEqual({ id: project.id, name: 'Atlas review' });
      expect(
        (
          await server.inject({ method: 'GET', url: '/api/inventory', headers })
        ).json().projects[0].name,
      ).toBe('Atlas review');
      for (const payload of [
        { name: '   ' },
        { name: 'two\nlines' },
        { name: 'x'.repeat(101) },
        { name: 'fine', extra: true },
        {},
      ])
        expect(
          (await rename(payload)).statusCode,
          JSON.stringify(payload),
        ).toBe(400);
      expect((await rename({ name: 'orphan' }, randomUUID())).statusCode).toBe(
        404,
      );
      expect((await rename({ name: 'bad id' }, 'not-a-uuid')).statusCode).toBe(
        400,
      );
      expect(
        (
          await server.inject({
            method: 'PATCH',
            url: `/api/projects/${project.id}`,
            payload: { name: 'unauthenticated' },
          })
        ).statusCode,
      ).toBe(401);
    } finally {
      await server.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('authenticates before validation and removes a project an old action blocked', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-remove-errors-'));
    const server = await createServer({
      pairingReach,
      dataDirectory: root,
      projectHome: root,
    });
    const headers = await pairDevice(server, server.application);
    await server.refreshed();
    try {
      expect(
        (
          await server.inject({
            method: 'DELETE',
            url: '/api/projects/invalid',
          })
        ).statusCode,
      ).toBe(401);
      expect(
        (
          await server.inject({
            method: 'DELETE',
            url: '/api/projects/invalid',
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
            url: '/api/projects',
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
        url: `/api/projects/${project.id}`,
        headers,
      });
      // A latch from an action that ended without a confirmed outcome used to
      // make this project unremovable for ever. Removal touches no disk, so
      // it is allowed, and the latch goes with it.
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ deleted: true });
      expect(response.headers['cache-control']).toBe('no-store');
      expect(
        (
          await server.inject({ method: 'GET', url: '/api/inventory', headers })
        ).json().projects,
      ).toEqual([]);
      // Read the latch once the server has closed: a second connection to a
      // live WAL database can answer from an older snapshot.
      await server.close();
      const after = new DatabaseSync(join(root, 'inventory.sqlite'));
      try {
        expect(after.prepare('SELECT * FROM git_action_blocks').all()).toEqual(
          [],
        );
      } finally {
        after.close();
      }
    } finally {
      await server.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
