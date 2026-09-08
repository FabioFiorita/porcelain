import { execFileSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  directoryResponseSchema,
  textResponseSchema,
} from '@porcelain/contracts/files';
import { projectResponseSchema } from '@porcelain/contracts/inventory';
import { describe, expect, it } from 'vitest';
import {
  type FileErrorCode,
  FileInspectionError,
} from '../../filesystem/errors/file-inspection-error.ts';
import { createServer } from '../server.ts';

describe('Files HTTP', () => {
  const token = 'files-fixture-token-at-least-32-characters';
  const headers = { authorization: `Bearer ${token}` };

  async function fixture(
    run: (
      server: Awaited<ReturnType<typeof createServer>>,
      root: string,
      path: string,
      id: string,
    ) => Promise<void>,
    options: Partial<Parameters<typeof createServer>[0]> = {},
  ) {
    const root = await realpath(
      await mkdtemp(join(tmpdir(), 'porcelain-files-http-')),
    );
    const path = join(root, 'project');
    await mkdir(path);
    execFileSync('git', ['init', '-b', 'main', path]);
    const server = await createServer({
      dataDirectory: join(root, 'state'),
      token,
      ...options,
    });
    try {
      const registered = await server.inject({
        method: 'POST',
        url: '/projects',
        headers,
        payload: { path },
      });
      const project = projectResponseSchema.parse(registered.json());
      const id = project.worktrees[0]?.id;
      if (!id) throw new Error('Fixture registration failed');
      await run(server, root, path, id);
    } finally {
      await server.close();
      await rm(root, { recursive: true, force: true });
    }
  }

  it('lists and reads through real authenticated loopback HTTP with exact public schemas', async () =>
    fixture(async (server, _root, path, id) => {
      await mkdir(join(path, 'src'));
      await writeFile(join(path, 'src', 'app.ts'), 'olá\r\n');
      const address = await server.listen({ host: '127.0.0.1', port: 0 });
      const listing = await fetch(
        `${address}/worktrees/${id}/directory?path=src`,
        { headers },
      );
      expect(listing.status).toBe(200);
      expect(listing.headers.get('cache-control')).toBe('no-store');
      const rawListing: unknown = await listing.json();
      expect(directoryResponseSchema.parse(rawListing)).toEqual(rawListing);
      expect(rawListing).toEqual({
        worktreeId: id,
        path: 'src',
        entries: [{ name: 'app.ts', kind: 'file' }],
      });
      const reading = await fetch(
        `${address}/worktrees/${id}/text?path=src%2Fapp.ts`,
        { headers },
      );
      expect(reading.status).toBe(200);
      expect(reading.headers.get('cache-control')).toBe('no-store');
      const rawText: unknown = await reading.json();
      expect(textResponseSchema.parse(rawText)).toEqual(rawText);
      expect(rawText).toEqual({
        worktreeId: id,
        path: 'src/app.ts',
        byteLength: 6,
        encoding: 'utf-8',
        text: 'olá\r\n',
      });
    }));

  it('authenticates before validation and file access; rejects traversal and unknown fields', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-files-auth-'));
    let reads = 0;
    const server = await createServer({
      dataDirectory: root,
      token,
      files: {
        list: async () => {
          reads++;
          throw new Error('unexpected read');
        },
        read: async () => {
          reads++;
          throw new Error('unexpected read');
        },
      },
    });
    try {
      for (const operation of ['directory', 'text']) {
        const response = await server.inject({
          method: 'GET',
          url: `/worktrees/invalid/${operation}?path=%2e%2e%2fprivate`,
        });
        expect(response.statusCode).toBe(401);
        expect(response.json()).toEqual({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        expect(response.headers['cache-control']).toBe('no-store');
      }
      const id = 'ccfb8c0d-4ba5-43e3-bca5-8b76000eec65';
      for (const query of [
        'path=%2e%2e%2fprivate',
        'path=%2Fprivate',
        'path=a%00b',
        'path=a&extra=1',
        'path=a&path=b',
        '',
      ]) {
        const response = await server.inject({
          method: 'GET',
          url: `/worktrees/${id}/text?${query}`,
          headers,
        });
        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({
          code: 'INVALID_REQUEST',
          message: 'Invalid request',
        });
      }
      const missing = await server.inject({
        method: 'GET',
        url: `/worktrees/${id}/directory?path=`,
        headers,
      });
      expect(missing.statusCode).toBe(404);
      expect(missing.json().code).toBe('WORKTREE_NOT_FOUND');
      expect(reads).toBe(0);
    } finally {
      await server.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('excludes metadata, refuses symlinks and decodes path queries only once', async () =>
    fixture(async (server, root, path, id) => {
      await writeFile(join(path, '%2e%2e'), 'literal encoded filename');
      await writeFile(join(root, 'private'), 'outside');
      await symlink(join(root, 'private'), join(path, 'link'));
      const read = (file: string) =>
        server.inject({
          method: 'GET',
          url: `/worktrees/${id}/text?path=${encodeURIComponent(file)}`,
          headers,
        });
      expect((await read('%2e%2e')).json().text).toBe(
        'literal encoded filename',
      );
      for (const file of ['link', '.git/config']) {
        const response = await read(file);
        expect(response.statusCode).toBe(422);
        expect(response.json().code).toBe('PATH_NOT_READABLE');
        expect(response.body).not.toContain(root);
      }
      expect((await read('missing')).statusCode).toBe(404);
      const listing = await server.inject({
        method: 'GET',
        url: `/worktrees/${id}/directory?path=`,
        headers,
      });
      expect(listing.json().entries).not.toContainEqual({
        name: '.git',
        kind: 'directory',
      });
    }));

  it('rejects missing or replaced checkouts and known unavailable inventory', async () =>
    fixture(async (server, root, path, id) => {
      const url = `/worktrees/${id}/directory?path=`;
      await rename(path, join(root, 'moved'));
      expect(
        (await server.inject({ method: 'GET', url, headers })).json().code,
      ).toBe('REPOSITORY_UNAVAILABLE');
      await mkdir(path);
      execFileSync('git', ['init', '-b', 'main', path]);
      expect(
        (await server.inject({ method: 'GET', url, headers })).json().code,
      ).toBe('REPOSITORY_UNAVAILABLE');
      await rm(path, { recursive: true });
      await server.inject({
        method: 'POST',
        url: '/inventory/refresh',
        headers,
      });
      expect(
        (await server.inject({ method: 'GET', url, headers })).json().code,
      ).toBe('REPOSITORY_UNAVAILABLE');
    }));

  it('maps every file failure safely without exposing causes or paths', async () => {
    let failure: Error = new Error('private path and credentials');
    await fixture(
      async (server, _root, _path, id) => {
        const failures: [FileErrorCode, number][] = [
          ['INVALID_REQUEST', 400],
          ['WORKTREE_NOT_FOUND', 404],
          ['REPOSITORY_UNAVAILABLE', 422],
          ['PATH_NOT_FOUND', 404],
          ['PATH_NOT_READABLE', 422],
          ['UNSUPPORTED_PATH', 422],
          ['UNSUPPORTED_TEXT', 422],
          ['FILE_TOO_LARGE', 422],
          ['DIRECTORY_TOO_LARGE', 422],
          ['CONTENT_CHANGED', 409],
        ];
        for (const [code, status] of failures) {
          failure = new FileInspectionError(code, {
            cause: new Error('/private/secret'),
          });
          const response = await server.inject({
            method: 'GET',
            url: `/worktrees/${id}/text?path=file`,
            headers,
          });
          expect(response.statusCode).toBe(status);
          expect(response.json().code).toBe(code);
          expect(Object.keys(response.json()).sort()).toEqual([
            'code',
            'message',
          ]);
          expect(response.body).not.toContain('private');
        }
        failure = new Error('/private/secret');
        const response = await server.inject({
          method: 'GET',
          url: `/worktrees/${id}/directory?path=`,
          headers,
        });
        expect(response.statusCode).toBe(500);
        expect(response.json()).toEqual({
          code: 'INTERNAL_ERROR',
          message: 'Operation failed',
        });
      },
      {
        files: {
          list: async () => {
            throw failure;
          },
          read: async () => {
            throw failure;
          },
        },
      },
    );
  });

  it('reads a linked worktree by its own identity rather than the main checkout', async () =>
    fixture(async (server, root, path, mainId) => {
      execFileSync('git', [
        '-C',
        path,
        '-c',
        'user.name=Fixture',
        '-c',
        'user.email=fixture@example.invalid',
        '-c',
        'commit.gpgsign=false',
        'commit',
        '--allow-empty',
        '-m',
        'fixture',
      ]);
      const linked = join(root, 'linked');
      execFileSync('git', [
        '-C',
        path,
        'worktree',
        'add',
        '-b',
        'linked',
        linked,
      ]);
      await writeFile(join(path, 'file'), 'main');
      await writeFile(join(linked, 'file'), 'linked');
      const refresh = await server.inject({
        method: 'POST',
        url: '/inventory/refresh',
        headers,
      });
      const project = projectResponseSchema.parse(refresh.json().projects[0]);
      const linkedId = project.worktrees.find(
        (worktree) => worktree.path === linked,
      )?.id;
      expect(linkedId).toBeDefined();
      for (const [id, text] of [
        [mainId, 'main'],
        [linkedId, 'linked'],
      ]) {
        const response = await server.inject({
          method: 'GET',
          url: `/worktrees/${id}/text?path=file`,
          headers,
        });
        expect(response.statusCode).toBe(200);
        expect(response.json().text).toBe(text);
      }
    }));
});
