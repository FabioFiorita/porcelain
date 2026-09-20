import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  access,
  mkdir,
  mkdtemp,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { GitCommandError } from '@porcelain/git/errors/git-command-error';
import { isRepositoryUnavailable } from '@porcelain/git/errors/is-repository-unavailable';
import { RepositoryIdentityMismatchError } from '@porcelain/git/errors/repository-identity-mismatch-error';
import { UnsupportedRepositoryError } from '@porcelain/git/errors/unsupported-repository-error';
import { Git } from '@porcelain/git/git';
import { afterEach, describe, expect, it } from 'vitest';
import { openApplication } from './app.ts';
import { ApplicationClosedError } from './lifecycle/errors/application-closed-error.ts';

describe('Application', () => {
  const roots: string[] = [];
  const applications: Awaited<ReturnType<typeof openApplication>>[] = [];
  function git(path: string, ...args: string[]) {
    return execFileSync('git', ['-C', path, ...args], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_AUTHOR_NAME: 'Fixture',
        GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
        GIT_COMMITTER_NAME: 'Fixture',
        GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
      },
    });
  }
  async function fixture() {
    const root = await realpath(
      await mkdtemp(join(tmpdir(), 'porcelain-inventory-')),
    );
    roots.push(root);
    const main = join(root, 'atlas');
    await mkdir(main);
    git(main, 'init', '-b', 'main');
    git(main, 'commit', '--allow-empty', '-m', 'Fixture');
    const linked = join(root, 'feature');
    git(main, 'worktree', 'add', '-b', 'feature', linked);
    const dataDirectory = join(root, 'state');
    return { root, main, linked, dataDirectory };
  }
  async function open(dataDirectory: string) {
    const app = await openApplication({
      dataDirectory,
      projectHome: dataDirectory,
    });
    await app.ready();
    applications.push(app);
    return app;
  }
  afterEach(async () => {
    for (const app of applications.splice(0)) await app.close();
    for (const root of roots.splice(0))
      await rm(root, { recursive: true, force: true });
  });

  describe('Registration and persistence', () => {
    it('registers from any checkout, groups worktrees main-first, and keeps separate clones distinct', async () => {
      const f = await fixture();
      const app = await open(f.dataDirectory);
      const { project } = await app.register(f.linked);
      expect(project.worktrees.map((w) => [w.path, w.main])).toEqual([
        [f.main, true],
        [f.linked, false],
      ]);
      expect((await app.register(f.main)).project.id).toBe(project.id);
      const clone = join(f.root, 'clone');
      git(f.root, 'clone', f.main, clone);
      expect((await app.register(clone)).project.id).not.toBe(project.id);
      expect((await app.inventory()).inventory.projects).toHaveLength(2);
    });

    it('persists identities and lists Git on restart, with independent environment IDs', async () => {
      const f = await fixture();
      const app = await open(f.dataDirectory);
      await app.register(f.main);
      const before = (await app.inventory()).inventory;
      await app.close();
      applications.splice(applications.indexOf(app), 1);
      git(f.linked, 'checkout', '-b', 'changed');
      const restarted = await open(f.dataDirectory);
      expect(restarted.environment().environmentId).toBe(before.environmentId);
      expect(
        (await restarted.inventory()).inventory.projects[0]?.worktrees.map(
          (w) => w.id,
        ),
      ).toEqual(before.projects[0]?.worktrees.map((w) => w.id));
      expect(
        (await restarted.inventory()).inventory.projects[0]?.worktrees[1]
          ?.branch,
      ).toBe('refs/heads/changed');
      expect(
        (await open(join(f.root, 'other-state'))).environment().environmentId,
      ).not.toBe(before.environmentId);
    });

    it('rejects non-repositories and bare repositories without persisting a project', async () => {
      const f = await fixture();
      const app = await open(f.dataDirectory);
      const failure = await app
        .register(f.root)
        .catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(GitCommandError);
      if (!(failure instanceof GitCommandError))
        throw new Error('Expected Git failure');
      expect(failure.cause).toBeInstanceOf(Error);
      expect(failure.checkout).toBe(f.root);
      const bare = join(f.root, 'bare');
      git(f.root, 'clone', '--bare', f.main, bare);
      await expect(app.register(bare)).rejects.toThrow(
        UnsupportedRepositoryError,
      );
      expect((await app.inventory()).inventory.projects).toEqual([]);
    });

    it('preserves a project after moving its main checkout and registering the new path', async () => {
      const f = await fixture();
      const app = await open(f.dataDirectory);
      const { project: before } = await app.register(f.main);
      const moved = join(f.root, 'new-main');
      await rename(f.main, moved);
      git(moved, 'worktree', 'repair');
      const { project: after } = await app.register(moved);
      expect(after.id).toBe(before.id);
      expect(after.worktrees.map((w) => w.id)).toEqual(
        before.worktrees.map((w) => w.id),
      );
    });

    it('serializes duplicate registrations and handles checkout paths containing newlines', async () => {
      const f = await fixture();
      const app = await open(f.dataDirectory);
      const strange = join(f.root, 'checkout\n');
      git(f.main, 'worktree', 'move', f.linked, strange);
      const [first, second] = await Promise.all([
        app.register(strange),
        app.register(f.main),
      ]);
      expect(first.project.id).toBe(second.project.id);
      expect(first.project.worktrees[1]).toMatchObject({
        path: strange,
        available: true,
      });
      expect((await app.inventory()).inventory.projects).toHaveLength(1);
    });

    it('registration does not inspect unrelated projects', async () => {
      const first = await fixture();
      const second = await fixture();
      let firstUnavailable = false;
      const app = await openApplication({
        dataDirectory: first.dataDirectory,
        projectHome: first.dataDirectory,
        git: (path) => {
          if (firstUnavailable && [first.main, first.linked].includes(path))
            throw new Error('Unrelated project was inspected');
          return new Git(path);
        },
      });
      await app.ready();
      applications.push(app);
      const { project: original } = await app.register(first.main);
      firstUnavailable = true;
      const { project: added } = await app.register(second.main);
      expect((await app.inventory()).inventory.projects).toEqual([
        original,
        added,
      ]);
    });
  });
  describe('Identity and availability', () => {
    it('preserves a moved linked checkout and removes disposed entries without reusing their IDs', async () => {
      const f = await fixture();
      const app = await open(f.dataDirectory);
      const { project: before } = await app.register(f.main);
      const moved = join(f.root, 'moved');
      git(f.main, 'worktree', 'move', f.linked, moved);
      const { inventory: after } = await app.inventory();
      expect(after.projects[0]?.worktrees[1]?.id).toBe(before.worktrees[1]?.id);
      expect(after.projects[0]?.worktrees[1]?.path).toBe(moved);
      git(f.main, 'worktree', 'remove', moved);
      expect(
        (await app.inventory()).inventory.projects[0]?.worktrees,
      ).toHaveLength(1);
      git(f.main, 'worktree', 'add', moved, 'feature');
      expect(
        (await app.inventory()).inventory.projects[0]?.worktrees[1]?.id,
      ).not.toBe(before.worktrees[1]?.id);
    });

    it('does not reuse identity when a checkout is replaced', async () => {
      const f = await fixture();
      const app = await open(f.dataDirectory);
      const { project: before } = await app.register(f.main);
      git(f.main, 'worktree', 'remove', f.linked);
      git(f.main, 'worktree', 'add', f.linked, 'feature');
      expect(
        (await app.inventory()).inventory.projects[0]?.worktrees[1]?.id,
      ).not.toBe(before.worktrees[1]?.id);
    });

    it('reports a project whose Git never answers as unavailable, and lists the rest', async () => {
      const f = await fixture();
      const slow = join(f.root, 'slow');
      await mkdir(slow);
      git(slow, 'init', '-b', 'main');
      git(slow, 'commit', '--allow-empty', '-m', 'Fixture');
      // A `git` that really does hang, for one repository only: everything
      // else runs the Git this machine has. A mock that resolves would prove
      // nothing about a mount that has stopped answering.
      const real = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
      const shim = join(f.root, 'bin');
      await mkdir(shim);
      await writeFile(
        join(shim, 'git'),
        `#!/bin/sh\ncase "$*" in *${slow}*) exec sleep 300 ;; esac\nexec ${real} "$@"\n`,
        { mode: 0o755 },
      );
      const app = await openApplication({
        dataDirectory: f.dataDirectory,
        projectHome: f.dataDirectory,
        projectListingTimeoutMs: 300,
      });
      applications.push(app);
      await app.ready();
      const { project: healthy } = await app.register(f.main);
      const { project: hanging } = await app.register(slow);
      const path = process.env.PATH;
      // From here on, that one repository's Git never answers.
      process.env.PATH = `${shim}:${path ?? ''}`;
      try {
        const { inventory } = await app.inventory();
        // Stored order, whichever answered first.
        expect(inventory.projects.map((project) => project.id)).toEqual([
          healthy.id,
          hanging.id,
        ]);
        expect(inventory.projects[0]).toMatchObject({
          available: true,
          worktrees: healthy.worktrees,
        });
        // The one that hung keeps what was last known about it rather than
        // looking like a repository whose worktrees were deleted.
        expect(inventory.projects[1]).toMatchObject({
          available: false,
          worktrees: hanging.worktrees.map((worktree) => ({
            ...worktree,
            available: false,
          })),
        });
      } finally {
        process.env.PATH = path;
      }
    }, 20_000);

    it('answers when more projects hang than can be listed at once', async () => {
      const f = await fixture();
      const real = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
      const shim = join(f.root, 'bin');
      await mkdir(shim);
      const slow = join(f.root, 'slow');
      await writeFile(
        join(shim, 'git'),
        `#!/bin/sh\ncase "$*" in *${slow}*) exec sleep 300 ;; esac\nexec ${real} "$@"\n`,
        { mode: 0o755 },
      );
      const app = await openApplication({
        dataDirectory: f.dataDirectory,
        projectHome: f.dataDirectory,
        projectListingTimeoutMs: 300,
        // Deliberately shorter than the six projects need: the budget has to
        // come from how many waves they take, or the last wave never gets its
        // own answer and the whole request fails instead.
        operationTimeoutMs: 500,
      });
      applications.push(app);
      await app.ready();
      const hanging: string[] = [];
      for (let index = 0; index < 6; index += 1) {
        const path = `${slow}-${index}`;
        await mkdir(path);
        git(path, 'init', '-b', 'main');
        git(path, 'commit', '--allow-empty', '-m', 'Fixture');
        hanging.push((await app.register(path)).project.id);
      }
      const previous = process.env.PATH;
      process.env.PATH = `${shim}:${previous ?? ''}`;
      try {
        const { inventory } = await app.inventory();
        expect(inventory.projects.map((project) => project.id)).toEqual(
          hanging,
        );
        expect(inventory.projects.map((project) => project.available)).toEqual(
          hanging.map(() => false),
        );
      } finally {
        process.env.PATH = previous;
      }
    }, 30_000);

    it('keeps a deleted checkout folder as an unavailable worktree, and off the clock', async () => {
      const f = await fixture();
      const app = await open(f.dataDirectory);
      const { project: before } = await app.register(f.main);
      const linked = before.worktrees[1]?.id ?? '';
      await app.replaceReviewLayers(linked, 0, [
        {
          id: '0f7a1a55-bd1e-4b0a-9ad4-96a3f6c2e5d8',
          title: 'Review',
          files: [{ path: 'notes.txt', scope: 'unstaged' }],
        },
      ]);
      await rm(f.linked, { recursive: true });
      const gitInventory = git(f.main, 'worktree', 'list', '--porcelain');
      expect(gitInventory).toContain('prunable');
      // Git still reports this worktree and its administrative directory is
      // still there, so it is unreadable rather than gone: it keeps its id,
      // and the thirty-day clock on its review data never starts. Deleting a
      // folder is not the same as `git worktree remove`.
      const { inventory, issues } = await app.inventory();
      expect(inventory.projects[0]?.worktrees).toEqual([
        before.worktrees[0],
        // Its layers are still published, so the dot still says so: the
        // worktree is unreachable, not finished with.
        {
          ...before.worktrees[1],
          id: linked,
          available: false,
          status: 'pending',
        },
      ]);
      expect(issues).toEqual([
        expect.objectContaining({ path: f.linked, error: expect.any(Error) }),
      ]);
      expect((await app.inventory()).inventory).toEqual(inventory);
      expect(git(f.main, 'worktree', 'list', '--porcelain')).toBe(gitInventory);
      await app.close();
      applications.splice(applications.indexOf(app), 1);
      const db = new DatabaseSync(join(f.dataDirectory, 'inventory.sqlite'));
      try {
        expect(
          db
            .prepare('SELECT worktree_id, missing_since FROM worktree_presence')
            .all(),
        ).toEqual([{ worktree_id: linked, missing_since: null }]);
      } finally {
        db.close();
      }
      const reopened = await open(f.dataDirectory);
      expect(
        (await reopened.inventory()).inventory.projects[0]?.worktrees,
      ).toEqual(inventory.projects[0]?.worktrees);
    });

    it('retains unreachable repositories and missing locked worktrees as unavailable', async () => {
      const f = await fixture();
      const app = await open(f.dataDirectory);
      const { project: before } = await app.register(f.main);
      git(f.main, 'worktree', 'lock', f.linked);
      await rename(f.linked, join(f.root, 'hidden-feature'));
      const { inventory: partial, issues: partialIssues } =
        await app.inventory();
      expect(partialIssues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: f.linked, error: expect.any(Error) }),
        ]),
      );
      expect(partial.projects[0]?.worktrees[1]).toMatchObject({
        id: before.worktrees[1]?.id,
        available: false,
      });
      await rename(f.main, join(f.root, 'hidden-main'));
      expect((await app.inventory()).inventory.projects[0]).toMatchObject({
        id: before.id,
        available: false,
      });
      await rename(join(f.root, 'hidden-main'), f.main);
      await rename(join(f.root, 'hidden-feature'), f.linked);
      expect(
        (await app.inventory()).inventory.projects[0]?.worktrees.map((w) => [
          w.id,
          w.available,
        ]),
      ).toEqual(before.worktrees.map((w) => [w.id, true]));
    });

    it('only lets a listing that worked say a worktree is missing', async () => {
      const f = await fixture();
      const app = await open(f.dataDirectory);
      const { project: before } = await app.register(f.main);
      const linked = before.worktrees[1]?.id ?? '';
      // Review data is what gives a worktree a presence row to measure from.
      await app.replaceReviewLayers(linked, 0, [
        {
          id: '6f1a6bd2-3f3e-4a55-9f0f-3f6ea1a4a7c2',
          title: 'Review',
          files: [{ path: 'notes.txt', scope: 'unstaged' }],
        },
      ]);
      // Read only while the application is closed: a second connection to a
      // live WAL database can answer from an older snapshot.
      const presence = async (
        running: Awaited<ReturnType<typeof openApplication>>,
      ) => {
        await running.close();
        applications.splice(applications.indexOf(running), 1);
        const db = new DatabaseSync(join(f.dataDirectory, 'inventory.sqlite'));
        try {
          return db
            .prepare('SELECT worktree_id, missing_since FROM worktree_presence')
            .all();
        } finally {
          db.close();
        }
      };
      // The whole repository is out of reach: nobody can say what exists, so
      // the thirty-day clock must not start. This is the unplugged disk.
      await rename(f.main, join(f.root, 'hidden-main'));
      expect((await app.inventory()).inventory.projects[0]).toMatchObject({
        available: false,
      });
      expect(await presence(app)).toEqual([
        { worktree_id: linked, missing_since: null },
      ]);
      // Reachable again, and this time Git really has stopped listing it.
      await rename(join(f.root, 'hidden-main'), f.main);
      git(f.main, 'worktree', 'remove', f.linked);
      const [row] = await presence(await open(f.dataDirectory));
      expect(row).toMatchObject({ worktree_id: linked });
      expect(
        Date.parse(String((row as { missing_since: string }).missing_since)),
      ).toBeGreaterThan(0);
    });

    it('refuses to read a worktree whose path another repository has taken', async () => {
      const f = await fixture();
      const app = await open(f.dataDirectory);
      const { project } = await app.register(f.main);
      const linked = project.worktrees[1];
      if (!linked) throw new Error('Missing fixture worktree');
      await writeFile(join(f.linked, 'notes.txt'), 'mine\n');
      expect((await app.readTextFile(linked.id, 'notes.txt')).text).toBe(
        'mine\n',
      );
      // The checkout moves away and a stranger's repository takes its place.
      // The administrative directory still points at this path, so nothing in
      // Git's own records says anything is wrong; only the checkout can.
      await rename(f.linked, join(f.root, 'moved-feature'));
      await mkdir(f.linked);
      git(f.linked, 'init', '-b', 'main');
      await writeFile(join(f.linked, 'notes.txt'), 'not mine\n');
      await expect(
        app.readTextFile(linked.id, 'notes.txt'),
      ).rejects.toMatchObject({ code: 'REPOSITORY_UNAVAILABLE' });
      expect(
        (await app.inventory()).inventory.projects[0]?.worktrees[1],
      ).toMatchObject({ id: linked.id, available: false });
    });

    it('does not inspect a different repository substituted at a linked checkout path', async () => {
      const f = await fixture();
      const app = await open(f.dataDirectory);
      const { project: before } = await app.register(f.main);
      await rename(f.linked, join(f.root, 'hidden'));
      git(f.root, 'clone', f.main, f.linked);
      expect(
        (await app.inventory()).inventory.projects[0]?.worktrees[1],
      ).toMatchObject({
        id: before.worktrees[1]?.id,
        available: false,
      });
    });

    it('marks the old project unavailable when registering a replacement at its former path', async () => {
      const f = await fixture();
      const app = await open(f.dataDirectory);
      const { project: original } = await app.register(f.main);
      git(f.main, 'worktree', 'remove', f.linked);
      const moved = join(f.root, 'original');
      await rename(f.main, moved);
      git(f.root, 'clone', moved, f.main);
      const { project: replacement, issues: replacementIssues } =
        await app.register(f.main);
      expect(replacement.id).not.toBe(original.id);
      expect(replacementIssues).toContainEqual({
        path: f.main,
        error: expect.any(RepositoryIdentityMismatchError),
      });
      expect(
        (await app.inventory()).inventory.projects.find(
          (p) => p.id === original.id,
        ),
      ).toMatchObject({ available: false });
      expect(
        (await app.inventory()).inventory.projects
          .filter((p) => p.available)
          .map((p) => p.id),
      ).toEqual([replacement.id]);
    });

    it('retains a registered checkout replaced by a bare repository as unavailable', async () => {
      const f = await fixture();
      const app = await open(f.dataDirectory);
      const { project: original } = await app.register(f.main);
      git(f.main, 'worktree', 'remove', f.linked);
      const moved = join(f.root, 'original');
      await rename(f.main, moved);
      git(f.root, 'clone', '--bare', moved, f.main);
      const { inventory, issues } = await app.inventory();
      expect(inventory.projects[0]).toMatchObject({
        id: original.id,
        available: false,
      });
      // The project's Git directory is gone, so listing fails before Git can
      // say the replacement is bare. Either way the repository cannot be
      // inspected and the diagnostic names the path.
      expect(issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: expect.stringContaining(f.main) }),
        ]),
      );
      expect(
        issues.every((issue) => isRepositoryUnavailable(issue.error)),
      ).toBe(true);
    });
  });
  describe('Cancellation and failure handling', () => {
    it('propagates system discovery failures without marking healthy inventory unavailable', async () => {
      const f = await fixture();
      let failure: Error | undefined;
      const app = await openApplication({
        dataDirectory: f.dataDirectory,
        projectHome: f.dataDirectory,
        git: (path) => ({
          listWorktrees: (signal) => {
            if (failure) return Promise.reject(failure);
            return new Git(path).listWorktrees(signal);
          },
          readOriginUrl: (signal) => new Git(path).readOriginUrl(signal),
        }),
      });
      await app.ready();
      applications.push(app);
      await app.register(f.main);
      const before = (await app.inventory()).inventory;
      failure = new GitCommandError(
        f.main,
        ['rev-parse'],
        Object.assign(new Error('Git unavailable'), { code: 'ENOENT' }),
      );
      // The fault reaches the caller rather than being reported as every
      // project having become unavailable.
      await expect(app.inventory()).rejects.toBe(failure);
      // And nothing was written on the way out: once Git works again the
      // inventory is exactly what it was.
      failure = undefined;
      expect((await app.inventory()).inventory).toEqual(before);
    });

    it('cancellation prevents a late discovery result from being persisted', async () => {
      const f = await fixture();
      const discovered = await new Git(f.main).listWorktrees();
      const started = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const app = await openApplication({
        dataDirectory: f.dataDirectory,
        projectHome: f.dataDirectory,
        git: () => ({
          listWorktrees: async () => {
            started.resolve();
            await release.promise;
            return discovered;
          },
          readOriginUrl: async () => null,
        }),
      });
      // Startup does not wait for a repository, so this never blocks here.
      applications.push(app);
      const controller = new AbortController();
      const registration = app.register(f.main, controller.signal);
      const rejected = expect(registration).rejects.toMatchObject({
        name: 'AbortError',
      });
      await started.promise;
      controller.abort();
      await rejected;
      release.resolve();
      // A following operation waits for the cancelled task to finish unwinding.
      await app.inventory();
      expect((await app.inventory()).inventory.projects).toEqual([]);
      await app.close();
      await expect(app.register(f.main)).rejects.toBeInstanceOf(
        ApplicationClosedError,
      );
      expect(() => app.environment()).toThrow(ApplicationClosedError);
    });

    it('does not create persistent state when startup is already cancelled', async () => {
      const f = await fixture();
      const signal = AbortSignal.abort();
      await expect(
        openApplication({
          dataDirectory: f.dataDirectory,
          projectHome: f.dataDirectory,
          signal,
        }),
      ).rejects.toBe(signal.reason);
      await expect(access(f.dataDirectory)).rejects.toMatchObject({
        code: 'ENOENT',
      });
    });

    it('returns diagnostics with their operation without changing earlier results', async () => {
      const f = await fixture();
      const app = await open(f.dataDirectory);
      await app.register(f.main);
      git(f.main, 'worktree', 'lock', f.linked);
      await rename(f.linked, join(f.root, 'hidden'));
      const first = await app.inventory();
      expect(first.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: f.linked, error: expect.any(Error) }),
        ]),
      );
      await rename(join(f.root, 'hidden'), f.linked);
      const second = await app.inventory();
      expect(second.issues).toEqual([]);
      expect(first.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: f.linked, error: expect.any(Error) }),
        ]),
      );
      expect(
        second.inventory.projects[0]?.worktrees.every(
          (worktree) => worktree.available,
        ),
      ).toBe(true);
    });
  });
  describe('Inputs are read as they were submitted', () => {
    it('inspects the submitted read request when caller objects change before queued execution', async () => {
      const f = await fixture();
      await writeFile(join(f.main, 'notes.txt'), 'before\n');
      git(f.main, 'add', '.');
      git(f.main, 'commit', '-m', 'Notes');
      const oid = git(f.main, 'rev-parse', 'HEAD').trim();
      await writeFile(join(f.main, 'notes.txt'), 'after\n');
      const writing = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const app = await openApplication({
        dataDirectory: f.dataDirectory,
        projectHome: f.dataDirectory,
        // Only the commit itself is faked: the reads under test still run
        // real Git, and this is what keeps them waiting.
        actionGit: () => ({
          inspect: async () => ({
            fingerprint: 'fixture',
            stashLog: '',
            preview: {
              headOid: null,
              branch: 'refs/heads/main',
              staged: true,
              trackedChanges: true,
              untrackedCount: 0,
            },
          }),
          execute: async () => {
            writing.resolve();
            await release.promise;
            return { state: 'succeeded', refreshRequired: false };
          },
        }),
      });
      await app.ready();
      applications.push(app);
      const { project } = await app.register(f.main);
      const worktreeId = project.worktrees[0]?.id;
      if (!worktreeId) throw new Error('Missing fixture worktree');
      const { status } = await app.gitStatus(worktreeId);
      const change = status.changes.find((entry) => entry.scope === 'unstaged');
      if (change?.scope !== 'unstaged')
        throw new Error('Missing unstaged change');
      // Read before the lane is held: a diff request carries the fingerprints
      // its list was read at, and this test is about the request objects.
      const { changes: listed } = await app.changes(worktreeId);
      const pageRequest = { limit: 1 };
      const commitRequest = { oid };
      // A commit is running, which holds this repository's lane as a writer,
      // so the three reads below are admitted only after it finishes: the
      // caller has a long window to mutate the objects it passed.
      const preparation = await app.prepareCommit(
        { projectId: project.id, worktreeId },
        { message: 'blocking' },
      );
      void app.executeCommit(
        { projectId: project.id, worktreeId },
        { requestId: randomUUID(), preparationId: preparation.id },
      );
      await writing.promise;
      const page = app.listCommits(worktreeId, pageRequest);
      const commit = app.commitFiles(worktreeId, commitRequest);
      const selection: {
        scope: 'staged' | 'unstaged';
        oldPath: string | null;
        newPath: string | null;
      } = {
        scope: change.scope,
        oldPath: change.oldPath,
        newPath: change.newPath,
      };
      const selections = [selection];
      const expected = listed
        .filter((entry) => entry.path === change.newPath)
        .map((entry) => ({
          path: entry.path,
          fingerprint: entry.fingerprint,
        }));
      const diffs = app.changeDiffs(
        worktreeId,
        status.statusToken,
        expected,
        selections,
      );
      pageRequest.limit = 0;
      commitRequest.oid = 'not-a-commit';
      selection.newPath = 'different.txt';
      selections.push({ ...selection, scope: 'staged' });
      expected.push({ path: 'different.txt', fingerprint: null });
      // Only now can the reads start, and every one of them was submitted
      // before its object was changed.
      release.resolve();
      expect((await page).commits.map((entry) => entry.oid)).toEqual([oid]);
      expect(await commit).toMatchObject({
        commit: expect.objectContaining({ oid }),
        files: [expect.objectContaining({ newPath: 'notes.txt' })],
      });
      expect((await diffs).diffs).toMatchObject([
        {
          selection: { newPath: 'notes.txt' },
          content: { kind: 'text', patch: expect.stringContaining('+after') },
        },
      ]);
    });

    it('snapshots preference intent before it is applied', async () => {
      const { main, dataDirectory } = await fixture();
      const app = await open(dataDirectory);
      const { project } = await app.register(main);
      const change = {
        path: 'original.ts',
        flag: 'pinned' as 'pinned' | 'hidden',
        value: true,
      };
      const pending = app.setFilePreference(project.id, change);
      change.path = 'mutated.ts';
      change.flag = 'hidden';
      change.value = false;
      expect(await pending).toEqual([
        { path: 'original.ts', pinned: true, hidden: false },
      ]);
      expect(await app.listFilePreferences(project.id)).toEqual([
        { path: 'original.ts', pinned: true, hidden: false },
      ]);
    });

    it('waits for a review-data read that is still listing before closing the database', async () => {
      const f = await fixture();
      const release = Promise.withResolvers<void>();
      const started = Promise.withResolvers<void>();
      let block = false;
      const app = await openApplication({
        dataDirectory: f.dataDirectory,
        projectHome: f.dataDirectory,
        git: (path) => ({
          listWorktrees: async (signal) => {
            if (block) {
              started.resolve();
              await release.promise;
            }
            return new Git(path).listWorktrees(signal);
          },
          readOriginUrl: (signal) => new Git(path).readOriginUrl(signal),
        }),
      });
      await app.ready();
      applications.push(app);
      await app.register(f.main);
      block = true;
      // An id the directory has never seen costs a listing, so this SQLite
      // read is parked in Git when shutdown begins. Resuming after the
      // database closed would be a read through a dangling handle.
      const pending = app.listArtifacts('0'.repeat(32));
      await started.promise;
      const closing = app.close();
      release.resolve();
      await expect(pending).rejects.toBeInstanceOf(ApplicationClosedError);
      await closing;
      applications.splice(applications.indexOf(app), 1);
    });

    it('persists submitted artifact values when the caller mutates them after the call', async () => {
      const f = await fixture();
      const app = await open(f.dataDirectory);
      const { project } = await app.register(f.main);
      const worktree = project.worktrees[0];
      if (!worktree) throw new Error('Missing fixture worktree');
      const input = { name: 'submitted.html', content: '<p>Submitted 😀</p>' };
      const submitted = { ...input };
      // An upload asks the resolver before it stores anything — a stat and two
      // small file reads, or a listing for an id the directory has not seen —
      // so the caller's object is still theirs to change while the write is
      // pending. This is that window, not a queue: artifact work takes no
      // lane.
      const upload = app.uploadArtifact(worktree.id, input);
      input.name = 'mutated.html';
      input.content = '<script>mutated()</script>';
      const artifact = await upload;
      expect(await app.getArtifact(worktree.id, artifact.id)).toMatchObject({
        ...submitted,
        sizeBytes: Buffer.byteLength(submitted.content),
      });
    });
  });
});
