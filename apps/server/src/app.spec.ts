import { execFileSync } from 'node:child_process';
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
import { afterEach, expect, it } from 'vitest';
import { openApplication } from './app.ts';
import { GitCommandError } from './git/errors/git-command-error.ts';
import { RepositoryIdentityMismatchError } from './git/errors/repository-identity-mismatch-error.ts';
import { UnsupportedRepositoryError } from './git/errors/unsupported-repository-error.ts';
import { Git } from './git/git.ts';
import { ApplicationClosedError } from './lifecycle/errors/application-closed-error.ts';

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
  const app = await openApplication({ dataDirectory });
  applications.push(app);
  return app;
}
afterEach(async () => {
  for (const app of applications.splice(0)) await app.close();
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});

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
  expect(app.inventory().projects).toHaveLength(2);
});

it('persists identities and refreshes Git on restart, with independent environment IDs', async () => {
  const f = await fixture();
  const app = await open(f.dataDirectory);
  await app.register(f.main);
  const before = app.inventory();
  await app.close();
  applications.splice(applications.indexOf(app), 1);
  git(f.linked, 'checkout', '-b', 'changed');
  const restarted = await open(f.dataDirectory);
  expect(restarted.inventory().environmentId).toBe(before.environmentId);
  expect(restarted.inventory().projects[0]?.worktrees.map((w) => w.id)).toEqual(
    before.projects[0]?.worktrees.map((w) => w.id),
  );
  expect(restarted.inventory().projects[0]?.worktrees[1]?.branch).toBe(
    'refs/heads/changed',
  );
  expect(
    (await open(join(f.root, 'other-state'))).inventory().environmentId,
  ).not.toBe(before.environmentId);
});

it('preserves a moved linked checkout and removes disposed entries without reusing their IDs', async () => {
  const f = await fixture();
  const app = await open(f.dataDirectory);
  const { project: before } = await app.register(f.main);
  const moved = join(f.root, 'moved');
  git(f.main, 'worktree', 'move', f.linked, moved);
  const { inventory: after } = await app.refresh();
  expect(after.projects[0]?.worktrees[1]?.id).toBe(before.worktrees[1]?.id);
  expect(after.projects[0]?.worktrees[1]?.path).toBe(moved);
  git(f.main, 'worktree', 'remove', moved);
  expect((await app.refresh()).inventory.projects[0]?.worktrees).toHaveLength(
    1,
  );
  git(f.main, 'worktree', 'add', moved, 'feature');
  expect(
    (await app.refresh()).inventory.projects[0]?.worktrees[1]?.id,
  ).not.toBe(before.worktrees[1]?.id);
});

it('does not reuse identity when a checkout is replaced between refreshes', async () => {
  const f = await fixture();
  const app = await open(f.dataDirectory);
  const { project: before } = await app.register(f.main);
  git(f.main, 'worktree', 'remove', f.linked);
  git(f.main, 'worktree', 'add', f.linked, 'feature');
  expect(
    (await app.refresh()).inventory.projects[0]?.worktrees[1]?.id,
  ).not.toBe(before.worktrees[1]?.id);
});

it('retains unreachable repositories and missing Git-listed worktrees as unavailable', async () => {
  const f = await fixture();
  const app = await open(f.dataDirectory);
  const { project: before } = await app.register(f.main);
  await rename(f.linked, join(f.root, 'hidden-feature'));
  const { inventory: partial, issues: partialIssues } = await app.refresh();
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
  expect((await app.refresh()).inventory.projects[0]).toMatchObject({
    id: before.id,
    available: false,
  });
  await rename(join(f.root, 'hidden-main'), f.main);
  await rename(join(f.root, 'hidden-feature'), f.linked);
  expect(
    (await app.refresh()).inventory.projects[0]?.worktrees.map((w) => [
      w.id,
      w.available,
    ]),
  ).toEqual(before.worktrees.map((w) => [w.id, true]));
});

it('rejects non-repositories and bare repositories without persisting a project', async () => {
  const f = await fixture();
  const app = await open(f.dataDirectory);
  const failure = await app.register(f.root).catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(GitCommandError);
  if (!(failure instanceof GitCommandError))
    throw new Error('Expected Git failure');
  expect(failure.cause).toBeInstanceOf(Error);
  expect(failure.checkout).toBe(f.root);
  const bare = join(f.root, 'bare');
  git(f.root, 'clone', '--bare', f.main, bare);
  await expect(app.register(bare)).rejects.toThrow(UnsupportedRepositoryError);
  expect(app.inventory().projects).toEqual([]);
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

it('does not inspect a different repository substituted at a linked checkout path', async () => {
  const f = await fixture();
  const app = await open(f.dataDirectory);
  const { project: before } = await app.register(f.main);
  await rename(f.linked, join(f.root, 'hidden'));
  git(f.root, 'clone', f.main, f.linked);
  expect(
    (await app.refresh()).inventory.projects[0]?.worktrees[1],
  ).toMatchObject({
    id: before.worktrees[1]?.id,
    available: false,
  });
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
  expect(app.inventory().projects).toHaveLength(1);
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
    app.inventory().projects.find((p) => p.id === original.id),
  ).toMatchObject({ available: false });
  expect(
    app
      .inventory()
      .projects.filter((p) => p.available)
      .map((p) => p.id),
  ).toEqual([replacement.id]);
});

it('registration does not inspect unrelated projects', async () => {
  const first = await fixture();
  const second = await fixture();
  let firstUnavailable = false;
  const app = await openApplication({
    dataDirectory: first.dataDirectory,
    git: (path) => {
      if (firstUnavailable && [first.main, first.linked].includes(path))
        throw new Error('Unrelated project was inspected');
      return new Git(path);
    },
  });
  applications.push(app);
  const { project: original } = await app.register(first.main);
  firstUnavailable = true;
  const { project: added } = await app.register(second.main);
  expect(app.inventory().projects).toEqual([original, added]);
});

it('propagates system discovery failures without marking healthy inventory unavailable', async () => {
  const f = await fixture();
  let failure: Error | undefined;
  const app = await openApplication({
    dataDirectory: f.dataDirectory,
    git: (path) => ({
      listWorktrees: (signal) => {
        if (failure) return Promise.reject(failure);
        return new Git(path).listWorktrees(signal);
      },
    }),
  });
  applications.push(app);
  await app.register(f.main);
  const before = app.inventory();
  failure = new GitCommandError(
    f.main,
    ['rev-parse'],
    Object.assign(new Error('Git unavailable'), { code: 'ENOENT' }),
  );
  await expect(app.refresh()).rejects.toBe(failure);
  expect(app.inventory()).toEqual(before);
});

it('cancellation prevents a late discovery result from being persisted', async () => {
  const f = await fixture();
  const discovered = await new Git(f.main).listWorktrees();
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const app = await openApplication({
    dataDirectory: f.dataDirectory,
    git: () => ({
      listWorktrees: async () => {
        started.resolve();
        await release.promise;
        return discovered;
      },
    }),
  });
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
  await app.refresh();
  expect(app.inventory().projects).toEqual([]);
  await app.close();
  await expect(app.register(f.main)).rejects.toBeInstanceOf(
    ApplicationClosedError,
  );
  expect(() => app.inventory()).toThrow(ApplicationClosedError);
});

it('retains a registered checkout replaced by a bare repository as unavailable', async () => {
  const f = await fixture();
  const app = await open(f.dataDirectory);
  const { project: original } = await app.register(f.main);
  git(f.main, 'worktree', 'remove', f.linked);
  const moved = join(f.root, 'original');
  await rename(f.main, moved);
  git(f.root, 'clone', '--bare', moved, f.main);
  const { inventory, issues } = await app.refresh();
  expect(inventory.projects[0]).toMatchObject({
    id: original.id,
    available: false,
  });
  expect(issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        path: f.main,
        error: expect.any(UnsupportedRepositoryError),
      }),
    ]),
  );
});

it('does not create persistent state when startup is already cancelled', async () => {
  const f = await fixture();
  const signal = AbortSignal.abort();
  await expect(
    openApplication({ dataDirectory: f.dataDirectory, signal }),
  ).rejects.toBe(signal.reason);
  await expect(access(f.dataDirectory)).rejects.toMatchObject({
    code: 'ENOENT',
  });
});

it('returns diagnostics with their operation without changing earlier results', async () => {
  const f = await fixture();
  const app = await open(f.dataDirectory);
  await app.register(f.main);
  await rename(f.linked, join(f.root, 'hidden'));
  const first = await app.refresh();
  expect(first.issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ path: f.linked, error: expect.any(Error) }),
    ]),
  );
  await rename(join(f.root, 'hidden'), f.linked);
  const second = await app.refresh();
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

it('inspects the submitted read request when caller objects change before queued execution', async () => {
  const f = await fixture();
  await writeFile(join(f.main, 'notes.txt'), 'before\n');
  git(f.main, 'add', '.');
  git(f.main, 'commit', '-m', 'Notes');
  const oid = git(f.main, 'rev-parse', 'HEAD').trim();
  await writeFile(join(f.main, 'notes.txt'), 'after\n');
  const app = await open(f.dataDirectory);
  const { project } = await app.register(f.main);
  const worktreeId = project.worktrees[0]?.id;
  if (!worktreeId) throw new Error('Missing fixture worktree');
  const { status } = await app.gitStatus(worktreeId);
  const change = status.changes.find((entry) => entry.scope === 'unstaged');
  if (change?.scope !== 'unstaged') throw new Error('Missing unstaged change');
  const pageRequest = { limit: 1 };
  const commitRequest = { oid };
  const refreshing = app.refresh();
  const page = app.listCommits(worktreeId, pageRequest);
  const commit = app.inspectCommitChanges(worktreeId, commitRequest);
  const diff = app.gitDiff(worktreeId, status.statusToken, change);
  pageRequest.limit = 0;
  commitRequest.oid = 'not-a-commit';
  change.newPath = 'different.txt';
  await refreshing;
  expect((await page).commits.map((entry) => entry.oid)).toEqual([oid]);
  expect(await commit).toMatchObject({
    commitOid: oid,
    changes: [expect.objectContaining({ newPath: 'notes.txt' })],
  });
  expect((await diff).content).toMatchObject({
    kind: 'text',
    patch: expect.stringContaining('+after'),
  });
});

it('snapshots preference intent before queued execution', async () => {
  const { main, dataDirectory } = await fixture();
  const app = await open(dataDirectory);
  const { project } = await app.register(main);
  const worktreeId = project.worktrees[0]?.id;
  if (!worktreeId) throw new Error('Missing fixture worktree');
  const refreshing = app.refresh();
  const change = {
    path: 'original.ts',
    flag: 'pinned' as 'pinned' | 'hidden',
    value: true,
  };
  const pending = app.setFilePreference(worktreeId, change);
  change.path = 'mutated.ts';
  change.flag = 'hidden';
  change.value = false;
  await refreshing;
  expect(await pending).toEqual([
    { path: 'original.ts', pinned: true, hidden: false },
  ]);
  expect(await app.listFilePreferences(worktreeId)).toEqual([
    { path: 'original.ts', pinned: true, hidden: false },
  ]);
});
