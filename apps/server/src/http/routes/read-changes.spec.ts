import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  changeDiffsResponseSchema,
  changeLinesResponseSchema,
  changesResponseSchema,
} from '@porcelain/contracts/changes';
import { projectResponseSchema } from '@porcelain/contracts/inventory';
import { InspectionGit } from '@porcelain/git/inspection-git';
import { describe, expect, it, vi } from 'vitest';
import { pairDevice, pairingReach } from '../helpers/paired-server.ts';
import { createServer } from '../server.ts';

const gitEnvironment = {
  ...process.env,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_AUTHOR_NAME: 'Fixture',
  GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
  GIT_COMMITTER_NAME: 'Fixture',
  GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
};

async function fixture(
  run: (context: {
    server: Awaited<ReturnType<typeof createServer>>;
    worktreeId: string;
    headers: { authorization: string };
    checkout: string;
    root: string;
    git: (args: string[]) => string;
  }) => Promise<void>,
) {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-changes-http-'));
  const checkout = join(root, 'checkout');
  await mkdir(checkout);
  const git = (args: string[]) =>
    execFileSync('git', ['-C', checkout, ...args], {
      env: gitEnvironment,
      encoding: 'utf8',
    });
  execFileSync('git', ['init', '-b', 'main', checkout], {
    env: gitEnvironment,
    stdio: 'ignore',
  });
  await writeFile(join(checkout, 'file.ts'), 'first\n');
  git(['add', '.']);
  git(['commit', '-m', 'Initial']);
  const server = await createServer({
    pairingReach,
    dataDirectory: join(root, 'state'),
    projectHome: join(root, 'state'),
  });
  const headers = await pairDevice(server, server.application);
  try {
    const project = projectResponseSchema.parse(
      (
        await server.inject({
          method: 'POST',
          url: '/api/projects',
          headers,
          payload: { path: checkout },
        })
      ).json(),
    );
    const worktreeId = project.worktrees[0]?.id;
    if (!worktreeId) throw new Error('Fixture registration failed');
    await run({ server, worktreeId, headers, checkout, root, git });
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
}

describe('Change reads over HTTP', () => {
  /**
   * The status token hashes what porcelain status prints, which says nothing
   * about the bytes of a file that was already modified. Editing such a file
   * again leaves the token identical while the patch changes, so the token
   * alone cannot keep a reader from being shown content that does not match
   * the fingerprint the mark beside it carries.
   */
  it('refuses hunks for a file edited since the list it was read from', async () => {
    await fixture(async ({ server, worktreeId, headers, checkout }) => {
      await writeFile(join(checkout, 'file.ts'), 'second\n');
      const list = changesResponseSchema.parse(
        (
          await server.inject({
            method: 'GET',
            url: `/api/worktrees/${worktreeId}/changes`,
            headers,
          })
        ).json(),
      );
      const entry = list.changes.find((change) => change.path === 'file.ts');
      const body = {
        expectedStatusToken: list.statusToken,
        expectedFiles: [
          { path: 'file.ts', fingerprint: entry?.fingerprint ?? null },
        ],
        selections: [
          { scope: 'unstaged', oldPath: 'file.ts', newPath: 'file.ts' },
        ],
      };
      const read = async () =>
        server.inject({
          method: 'POST',
          url: `/api/worktrees/${worktreeId}/changes/diffs`,
          headers,
          payload: body,
        });
      const first = await read();
      expect(first.statusCode).toBe(200);
      expect(
        changeDiffsResponseSchema.parse(first.json()).diffs[0]?.content,
      ).toMatchObject({ patch: expect.stringContaining('+second') });

      // The edit Git's status cannot see.
      await writeFile(join(checkout, 'file.ts'), 'third\n');
      const after = changesResponseSchema.parse(
        (
          await server.inject({
            method: 'GET',
            url: `/api/worktrees/${worktreeId}/changes`,
            headers,
          })
        ).json(),
      );
      expect(after.statusToken).toBe(list.statusToken);
      expect(
        after.changes.find((change) => change.path === 'file.ts')?.fingerprint,
      ).not.toBe(entry?.fingerprint);

      const stale = await read();
      expect(stale.statusCode).toBe(409);
      expect(stale.json()).toMatchObject({ code: 'WORKTREE_CHANGED' });
    });
  });

  /**
   * Confirming before the diff only says the content was right when the read
   * started. A file edited while Git is reading it would answer with the newer
   * patch under the older fingerprint — the exact pairing a reader must never
   * be shown, because the mark beside it carries that older fingerprint.
   */
  it('refuses hunks for a file edited while they were being read', async () => {
    await fixture(async ({ server, worktreeId, headers, checkout }) => {
      await writeFile(join(checkout, 'file.ts'), 'second\n');
      const list = changesResponseSchema.parse(
        (
          await server.inject({
            method: 'GET',
            url: `/api/worktrees/${worktreeId}/changes`,
            headers,
          })
        ).json(),
      );
      const entry = list.changes.find((change) => change.path === 'file.ts');
      const original = InspectionGit.prototype.readDiffs;
      const spy = vi
        .spyOn(InspectionGit.prototype, 'readDiffs')
        .mockImplementationOnce(async function (
          this: InspectionGit,
          changes,
          signal,
        ) {
          const patches = await original.call(this, changes, signal);
          // The edit lands after the hunks were produced and before the
          // answer is bound to anything.
          await writeFile(join(checkout, 'file.ts'), 'third\n');
          return patches;
        });
      try {
        const response = await server.inject({
          method: 'POST',
          url: `/api/worktrees/${worktreeId}/changes/diffs`,
          headers,
          payload: {
            expectedStatusToken: list.statusToken,
            expectedFiles: [
              { path: 'file.ts', fingerprint: entry?.fingerprint ?? null },
            ],
            selections: [
              { scope: 'unstaged', oldPath: 'file.ts', newPath: 'file.ts' },
            ],
          },
        });
        expect(response.statusCode).toBe(409);
        expect(response.json()).toMatchObject({ code: 'WORKTREE_CHANGED' });
        expect(response.body).not.toContain('third');
      } finally {
        spy.mockRestore();
      }
    });
  });

  /**
   * The hardest case, and the one comparing content on either side cannot
   * see: the file is written to something else, Git captures *that*, and it is
   * written back before the read returns. Both observations agree, both
   * fingerprints agree — and the hunks describe a state that no longer exists
   * anywhere. Only a stamp that a write moves and cannot put back catches it.
   */
  it('refuses hunks captured of content that was changed and changed back', async () => {
    await fixture(async ({ server, worktreeId, headers, checkout }) => {
      await writeFile(join(checkout, 'file.ts'), 'second\n');
      const list = changesResponseSchema.parse(
        (
          await server.inject({
            method: 'GET',
            url: `/api/worktrees/${worktreeId}/changes`,
            headers,
          })
        ).json(),
      );
      const entry = list.changes.find((change) => change.path === 'file.ts');
      const original = InspectionGit.prototype.readDiffs;
      const spy = vi
        .spyOn(InspectionGit.prototype, 'readDiffs')
        .mockImplementationOnce(async function (
          this: InspectionGit,
          changes,
          signal,
        ) {
          await writeFile(join(checkout, 'file.ts'), 'third\n');
          const patches = await original.call(this, changes, signal);
          await writeFile(join(checkout, 'file.ts'), 'second\n');
          return patches;
        });
      try {
        const response = await server.inject({
          method: 'POST',
          url: `/api/worktrees/${worktreeId}/changes/diffs`,
          headers,
          payload: {
            expectedStatusToken: list.statusToken,
            expectedFiles: [
              { path: 'file.ts', fingerprint: entry?.fingerprint ?? null },
            ],
            selections: [
              { scope: 'unstaged', oldPath: 'file.ts', newPath: 'file.ts' },
            ],
          },
        });
        expect(response.statusCode).toBe(409);
        expect(response.json()).toMatchObject({ code: 'WORKTREE_CHANGED' });
        expect(response.body).not.toContain('third');
      } finally {
        spy.mockRestore();
      }
    });
  });

  /**
   * A lexically valid path is not a safe one. The last component, or any
   * ancestor, can be a link pointing anywhere on the machine, and reading a
   * range of lines must refuse it exactly as every other file read does.
   */
  it('refuses a working path that leaves the checkout through a link', async () => {
    await fixture(async ({ server, worktreeId, headers, checkout, root }) => {
      await writeFile(join(root, 'secret'), 'outside-secret\n');
      await symlink(join(root, 'secret'), join(checkout, 'link'));
      await mkdir(join(root, 'elsewhere'));
      await writeFile(join(root, 'elsewhere', 'secret'), 'also-outside\n');
      await symlink(join(root, 'elsewhere'), join(checkout, 'through'));
      const read = (path: string) =>
        server.inject({
          method: 'GET',
          url: `/api/worktrees/${worktreeId}/changes/lines?${new URLSearchParams(
            { path, from: '1', to: '5', at: 'worktree' },
          )}`,
          headers,
        });
      for (const path of ['link', 'through/secret']) {
        const response = await read(path);
        expect(response.statusCode, path).toBe(422);
        expect(response.body).not.toContain('outside');
      }
      // The file that is really in the checkout still reads.
      const inside = await read('file.ts');
      expect(inside.statusCode).toBe(200);
      expect(changeLinesResponseSchema.parse(inside.json()).lines).toEqual([
        'first',
      ]);
    });
  });

  it('refuses a working file larger than a snippet instead of reading it', async () => {
    await fixture(async ({ server, worktreeId, headers, checkout }) => {
      await writeFile(join(checkout, 'huge.txt'), 'x'.repeat(2 * 1024 * 1024));
      const response = await server.inject({
        method: 'GET',
        url: `/api/worktrees/${worktreeId}/changes/lines?${new URLSearchParams({
          path: 'huge.txt',
          from: '1',
          to: '5',
          at: 'worktree',
        })}`,
        headers,
      });
      expect(response.statusCode).toBe(422);
      expect(response.json()).toMatchObject({ code: 'FILE_TOO_LARGE' });
    });
  });

  /**
   * A submodule's working side is a directory, so nothing on the filesystem
   * can digest it, and the status prints the same gitlink on both sides. Where
   * it points has to be asked of Git, or an unstaged pointer move would be
   * permanently unmarkable.
   */
  it('fingerprints an unstaged submodule pointer move', async () => {
    await fixture(async ({ server, worktreeId, headers, checkout, root }) => {
      const inner = join(root, 'inner');
      await mkdir(inner);
      execFileSync('git', ['init', '-b', 'main', inner], {
        env: gitEnvironment,
        stdio: 'ignore',
      });
      const innerGit = (args: string[]) =>
        execFileSync('git', ['-C', inner, ...args], {
          env: gitEnvironment,
          encoding: 'utf8',
        });
      await writeFile(join(inner, 'a.txt'), 'one\n');
      innerGit(['add', '.']);
      innerGit(['commit', '-m', 'one']);
      const first = innerGit(['rev-parse', 'HEAD']).trim();
      await writeFile(join(inner, 'a.txt'), 'two\n');
      innerGit(['add', '.']);
      innerGit(['commit', '-m', 'two']);

      execFileSync(
        'git',
        [
          '-C',
          checkout,
          '-c',
          'protocol.file.allow=always',
          'submodule',
          'add',
          '-q',
          inner,
          'sub',
        ],
        { env: gitEnvironment, stdio: 'ignore' },
      );
      execFileSync('git', ['-C', checkout, 'commit', '-qm', 'add sub'], {
        env: gitEnvironment,
        stdio: 'ignore',
      });
      // Move only the pointer, which is what the parent reviews.
      execFileSync(
        'git',
        ['-C', join(checkout, 'sub'), 'checkout', '-q', first],
        {
          env: gitEnvironment,
          stdio: 'ignore',
        },
      );

      const list = changesResponseSchema.parse(
        (
          await server.inject({
            method: 'GET',
            url: `/api/worktrees/${worktreeId}/changes`,
            headers,
          })
        ).json(),
      );
      const pointer = list.changes.find((change) => change.path === 'sub');
      expect(pointer?.comparisons[0]).toMatchObject({
        scope: 'unstaged',
        newMode: '160000',
      });
      expect(pointer?.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  /**
   * The Git package promises unusual filenames work. Hashing working files
   * through Git broke on the first newline; reading them from the filesystem
   * does not care what they are called.
   */
  it('lists a change whose filename contains a newline', async () => {
    await fixture(async ({ server, worktreeId, headers, checkout }) => {
      await writeFile(join(checkout, 'line\nbreak.txt'), 'new\n');
      const list = changesResponseSchema.parse(
        (
          await server.inject({
            method: 'GET',
            url: `/api/worktrees/${worktreeId}/changes`,
            headers,
          })
        ).json(),
      );
      expect(
        list.changes.find((change) => change.path === 'line\nbreak.txt'),
      ).toMatchObject({ fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/) });
    });
  });
});
