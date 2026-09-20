import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
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
import { NodeFileWriter } from '../../filesystem/file-writer.ts';
import { pairDevice, pairingReach } from '../helpers/paired-server.ts';
import { createServer } from '../server.ts';

describe('Files HTTP', () => {
  async function fixture(
    run: (
      server: Awaited<ReturnType<typeof createServer>>,
      root: string,
      path: string,
      id: string,
      headers: { authorization: string },
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
      pairingReach,
      dataDirectory: join(root, 'state'),
      projectHome: join(root, 'state'),
      ...options,
    });
    const headers = await pairDevice(server, server.application);
    try {
      const registered = await server.inject({
        method: 'POST',
        url: '/api/projects',
        headers,
        payload: { path },
      });
      const project = projectResponseSchema.parse(registered.json());
      const id = project.worktrees[0]?.id;
      if (!id) throw new Error('Fixture registration failed');
      await run(server, root, path, id, headers);
    } finally {
      await server.close();
      await rm(root, { recursive: true, force: true });
    }
  }

  it('serves bounded preview assets while rejecting unauthenticated, escaping and symlink reads', async () => {
    await fixture(async (server, root, path, id, headers) => {
      const bytes = Buffer.from([137, 80, 78, 71, 0, 255]);
      await writeFile(join(path, 'image.png'), bytes);
      const url = `/api/worktrees/${id}/asset?path=image.png`;
      expect((await server.inject({ url })).statusCode).toBe(401);
      const response = await server.inject({ url, headers });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        path: 'image.png',
        mediaType: 'image/png',
        base64: bytes.toString('base64'),
      });
      await writeFile(join(root, 'outside.png'), bytes);
      await symlink(join(root, 'outside.png'), join(path, 'link.png'));
      // A rejection test that accepts any 4xx or a 500 cannot tell a refusal
      // from a crash, which is the one thing it exists to tell apart.
      // Each of these is refused for its own reason, and the test says which:
      // a lumped "any 4xx" cannot tell a refusal from a crash, nor one refusal
      // path from another.
      for (const [target, expected] of [
        ['../outside.png', { statusCode: 400, code: 'INVALID_REQUEST' }],
        ['.git/config', { statusCode: 422, code: 'PATH_NOT_READABLE' }],
        ['link.png', { statusCode: 422, code: 'PATH_NOT_READABLE' }],
      ] as const) {
        const rejected = await server.inject({
          url: `/api/worktrees/${id}/asset?path=${encodeURIComponent(target)}`,
          headers,
        });
        expect(rejected.statusCode, target).toBe(expected.statusCode);
        expect(rejected.json().code, target).toBe(expected.code);
        // And nothing of the file it was pointed at came back.
        expect(rejected.body, target).not.toContain('outside');
      }
      await writeFile(
        join(path, 'huge.png'),
        Buffer.alloc(10 * 1024 * 1024 + 1),
      );
      expect(
        (
          await server.inject({
            url: `/api/worktrees/${id}/asset?path=huge.png`,
            headers,
          })
        ).json().code,
      ).toBe('FILE_TOO_LARGE');
    });
  });

  it('lists and reads through real authenticated loopback HTTP with exact public schemas', async () =>
    fixture(async (server, _root, path, id, headers) => {
      await mkdir(join(path, 'src'));
      await writeFile(join(path, 'src', 'app.ts'), 'olá\r\n');
      const address = await server.listen({ host: '127.0.0.1', port: 0 });
      const listing = await fetch(
        `${address}/api/worktrees/${id}/directory?path=src`,
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
        `${address}/api/worktrees/${id}/text?path=src%2Fapp.ts`,
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
        contentFingerprint: createHash('sha256')
          .update('olá\r\n')
          .digest('hex'),
      });
    }));

  it('authenticates before validation and file access; rejects traversal and unknown fields', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-files-auth-'));
    let reads = 0;
    const server = await createServer({
      pairingReach,
      dataDirectory: root,
      projectHome: root,
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
    const headers = await pairDevice(server, server.application);
    try {
      for (const operation of ['directory', 'text']) {
        const response = await server.inject({
          method: 'GET',
          url: `/api/worktrees/invalid/${operation}?path=%2e%2e%2fprivate`,
        });
        expect(response.statusCode).toBe(401);
        expect(response.json()).toEqual({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        expect(response.headers['cache-control']).toBe('no-store');
      }
      // Well formed but unknown: a derived id, not one of the UUIDs this
      // replaced, so the request reaches the lookup rather than validation.
      const id = 'ccfb8c0d4ba543e3bca58b76000eec65';
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
          url: `/api/worktrees/${id}/text?${query}`,
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
        url: `/api/worktrees/${id}/directory?path=`,
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
    fixture(async (server, root, path, id, headers) => {
      await writeFile(join(path, '%2e%2e'), 'literal encoded filename');
      await writeFile(join(root, 'private'), 'outside');
      await symlink(join(root, 'private'), join(path, 'link'));
      const read = (file: string) =>
        server.inject({
          method: 'GET',
          url: `/api/worktrees/${id}/text?path=${encodeURIComponent(file)}`,
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
        url: `/api/worktrees/${id}/directory?path=`,
        headers,
      });
      expect(listing.json().entries).not.toContainEqual({
        name: '.git',
        kind: 'directory',
      });
    }));

  it('rejects missing or replaced checkouts and known unavailable inventory', async () =>
    fixture(async (server, root, path, id, headers) => {
      const url = `/api/worktrees/${id}/directory?path=`;
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
        method: 'GET',
        url: '/api/inventory',
        headers,
      });
      expect(
        (await server.inject({ method: 'GET', url, headers })).json().code,
      ).toBe('REPOSITORY_UNAVAILABLE');
    }));

  it('maps every file failure safely without exposing causes or paths', async () => {
    let failure: Error = new Error('private path and credentials');
    await fixture(
      async (server, _root, _path, id, headers) => {
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
            url: `/api/worktrees/${id}/text?path=file`,
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
          url: `/api/worktrees/${id}/directory?path=`,
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
    fixture(async (server, root, path, mainId, headers) => {
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
        method: 'GET',
        url: '/api/inventory',
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
          url: `/api/worktrees/${id}/text?path=file`,
          headers,
        });
        expect(response.statusCode).toBe(200);
        expect(response.json().text).toBe(text);
      }
    }));
  it('writes only the expected text version, and lists one folder with its ignored and linked entries', async () =>
    fixture(async (server, root, path, id, headers) => {
      await mkdir(join(path, 'src'));
      await writeFile(join(path, 'src/a.ts'), 'original');
      await writeFile(join(path, '.gitignore'), 'ignored/\n');
      await mkdir(join(path, 'ignored'));
      await writeFile(join(path, 'ignored/large.txt'), 'ignored contents');
      await symlink('src/a.ts', join(path, 'link'));
      // One folder, with everything the tree needs to draw it: an ignored
      // directory is one dimmed row, and nothing descends into it to say so.
      const listing = await server.inject({
        method: 'GET',
        url: `/api/worktrees/${id}/directory?path=`,
        headers,
      });
      expect(listing.statusCode).toBe(200);
      expect(listing.json().entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'src', kind: 'directory' }),
          expect.objectContaining({
            name: 'ignored',
            kind: 'directory',
            ignored: true,
          }),
          expect.objectContaining({
            name: 'link',
            kind: 'symlink',
            target: 'src/a.ts',
          }),
        ]),
      );
      expect(
        listing
          .json()
          .entries.find((entry: { name: string }) => entry.name === 'src')
          ?.ignored,
      ).toBeUndefined();
      // Quick open is the whole list of names, bounded, in one Git process.
      const paths = await server.inject({
        method: 'GET',
        url: `/api/worktrees/${id}/paths`,
        headers,
      });
      expect(paths.statusCode).toBe(200);
      expect(paths.json().paths).toContain('src/a.ts');
      expect(paths.json().paths).not.toContain('ignored/large.txt');
      const payload = {
        kind: 'write',
        path: 'src/a.ts',
        text: 'saved',
        expectedFingerprint: createHash('sha256')
          .update('original')
          .digest('hex'),
      };
      const saved = await server.inject({
        method: 'POST',
        url: `/api/worktrees/${id}/files`,
        headers,
        payload,
      });
      expect(saved.statusCode).toBe(200);
      expect(saved.json().contentFingerprint).toBe(
        createHash('sha256').update('saved').digest('hex'),
      );
      const stale = await server.inject({
        method: 'POST',
        url: `/api/worktrees/${id}/files`,
        headers,
        payload: { ...payload, text: 'stale overwrite' },
      });
      expect(stale.statusCode).toBe(409);
      expect(await readFile(join(path, 'src/a.ts'), 'utf8')).toBe('saved');
      // Each refusal is named: a traversing or absolute path never reaches the
      // filesystem, and `.git` is refused by the read boundary itself.
      for (const [invalid, expected] of [
        ['../outside', { statusCode: 400, code: 'INVALID_REQUEST' }],
        ['/tmp/outside', { statusCode: 400, code: 'INVALID_REQUEST' }],
        ['.git/config', { statusCode: 422, code: 'PATH_NOT_READABLE' }],
      ] as const) {
        const response = await server.inject({
          method: 'POST',
          url: `/api/worktrees/${id}/files`,
          headers,
          payload: { kind: 'create', path: invalid, entryKind: 'file' },
        });
        expect(response.statusCode, invalid).toBe(expected.statusCode);
        expect(response.json().code, invalid).toBe(expected.code);
      }
      // The refusals left nothing behind them: no `outside` beside the
      // checkout, and `.git/config` is the file it always was.
      expect(await readdir(root)).not.toContain('outside');
      expect(await readdir(path)).not.toContain('outside');
      await expect(lstat(join(path, '.git', 'config'))).resolves.toMatchObject({
        size: expect.any(Number),
      });
    }));

  /**
   * Move and trash change the owner's real files and had no coverage at this
   * boundary at all. Each refusal here is one the owner can act on, and each
   * is proved to have left the files alone.
   */
  it('moves and trashes entries, and refuses without touching anything', async () =>
    fixture(async (server, _root, path, id, headers) => {
      await mkdir(join(path, 'src'));
      await writeFile(join(path, 'src', 'a.ts'), 'contents\n');
      await writeFile(join(path, 'src', 'taken.ts'), 'someone else\n');
      const edit = (payload: Record<string, string>) =>
        server.inject({
          method: 'POST',
          url: `/api/worktrees/${id}/files`,
          headers,
          payload,
        });

      const moved = await edit({
        kind: 'move',
        path: 'src/a.ts',
        destination: 'src/b.ts',
      });
      expect(moved.statusCode).toBe(200);
      expect(moved.json()).toMatchObject({ path: 'src/b.ts' });
      expect(await readFile(join(path, 'src', 'b.ts'), 'utf8')).toBe(
        'contents\n',
      );
      expect(await readdir(join(path, 'src'))).not.toContain('a.ts');

      // An existing destination is never replaced, and the mover keeps its file.
      const collision = await edit({
        kind: 'move',
        path: 'src/b.ts',
        destination: 'src/taken.ts',
      });
      expect(collision.statusCode).toBe(409);
      expect(collision.json().code).toBe('ENTRY_EXISTS');
      expect(await readFile(join(path, 'src', 'taken.ts'), 'utf8')).toBe(
        'someone else\n',
      );
      expect(await readFile(join(path, 'src', 'b.ts'), 'utf8')).toBe(
        'contents\n',
      );

      for (const outside of ['../outside.ts', '/tmp/outside.ts']) {
        const escaping = await edit({
          kind: 'move',
          path: 'src/b.ts',
          destination: outside,
        });
        expect(escaping.statusCode, outside).toBe(400);
        expect(escaping.json().code, outside).toBe('INVALID_REQUEST');
        expect(await readFile(join(path, 'src', 'b.ts'), 'utf8')).toBe(
          'contents\n',
        );
      }

      const trashed = await edit({ kind: 'trash', path: 'src/taken.ts' });
      expect(trashed.statusCode).toBe(200);
      expect(await readdir(join(path, 'src'))).toEqual(['b.ts']);
    }));

  it('refuses a delete this machine cannot make recoverable', async () =>
    fixture(
      async (server, _root, path, id, headers) => {
        await writeFile(join(path, 'keep.ts'), 'still here\n');
        const response = await server.inject({
          method: 'POST',
          url: `/api/worktrees/${id}/files`,
          headers,
          payload: { kind: 'trash', path: 'keep.ts' },
        });
        expect(response.statusCode).toBe(422);
        expect(response.json()).toEqual({
          code: 'TRASH_UNAVAILABLE',
          message: 'This machine has no trash; nothing was deleted',
        });
        // Delete means recoverable. With nowhere to recover from, the file
        // stays rather than being quietly unlinked.
        expect(await readFile(join(path, 'keep.ts'), 'utf8')).toBe(
          'still here\n',
        );
      },
      {
        fileWriter: new NodeFileWriter(async () => {
          throw new Error('no trash on this machine');
        }),
      },
    ));
});
