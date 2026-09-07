import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { openApplication } from './app.ts';

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
  const project = await app.register(f.linked);
  expect(project.worktrees.map((w) => [w.path, w.main])).toEqual([
    [f.main, true],
    [f.linked, false],
  ]);
  expect((await app.register(f.main)).id).toBe(project.id);
  const clone = join(f.root, 'clone');
  git(f.root, 'clone', f.main, clone);
  expect((await app.register(clone)).id).not.toBe(project.id);
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
  const before = await app.register(f.main);
  const moved = join(f.root, 'moved');
  git(f.main, 'worktree', 'move', f.linked, moved);
  const after = await app.refresh();
  expect(after.projects[0]?.worktrees[1]?.id).toBe(before.worktrees[1]?.id);
  expect(after.projects[0]?.worktrees[1]?.path).toBe(moved);
  git(f.main, 'worktree', 'remove', moved);
  expect((await app.refresh()).projects[0]?.worktrees).toHaveLength(1);
  git(f.main, 'worktree', 'add', moved, 'feature');
  expect((await app.refresh()).projects[0]?.worktrees[1]?.id).not.toBe(
    before.worktrees[1]?.id,
  );
});

it('does not reuse identity when a checkout is replaced between refreshes', async () => {
  const f = await fixture();
  const app = await open(f.dataDirectory);
  const before = await app.register(f.main);
  git(f.main, 'worktree', 'remove', f.linked);
  git(f.main, 'worktree', 'add', f.linked, 'feature');
  expect((await app.refresh()).projects[0]?.worktrees[1]?.id).not.toBe(
    before.worktrees[1]?.id,
  );
});

it('retains unreachable repositories and missing Git-listed worktrees as unavailable', async () => {
  const f = await fixture();
  const app = await open(f.dataDirectory);
  const before = await app.register(f.main);
  await rename(f.linked, join(f.root, 'hidden-feature'));
  const partial = await app.refresh();
  expect(partial.projects[0]?.worktrees[1]).toMatchObject({
    id: before.worktrees[1]?.id,
    available: false,
  });
  await rename(f.main, join(f.root, 'hidden-main'));
  expect((await app.refresh()).projects[0]).toMatchObject({
    id: before.id,
    available: false,
  });
  await rename(join(f.root, 'hidden-main'), f.main);
  await rename(join(f.root, 'hidden-feature'), f.linked);
  expect(
    (await app.refresh()).projects[0]?.worktrees.map((w) => [
      w.id,
      w.available,
    ]),
  ).toEqual(before.worktrees.map((w) => [w.id, true]));
});

it('rejects non-repositories and bare repositories without persisting a project', async () => {
  const f = await fixture();
  const app = await open(f.dataDirectory);
  await expect(app.register(f.root)).rejects.toThrow();
  const bare = join(f.root, 'bare');
  git(f.root, 'clone', '--bare', f.main, bare);
  await expect(app.register(bare)).rejects.toThrow('Bare repositories');
  expect(app.inventory().projects).toEqual([]);
});

it('preserves a project after moving its main checkout and registering the new path', async () => {
  const f = await fixture();
  const app = await open(f.dataDirectory);
  const before = await app.register(f.main);
  const moved = join(f.root, 'new-main');
  await rename(f.main, moved);
  git(moved, 'worktree', 'repair');
  const after = await app.register(moved);
  expect(after.id).toBe(before.id);
  expect(after.worktrees.map((w) => w.id)).toEqual(
    before.worktrees.map((w) => w.id),
  );
});

it('does not inspect a different repository substituted at a linked checkout path', async () => {
  const f = await fixture();
  const app = await open(f.dataDirectory);
  const before = await app.register(f.main);
  await rename(f.linked, join(f.root, 'hidden'));
  git(f.root, 'clone', f.main, f.linked);
  expect((await app.refresh()).projects[0]?.worktrees[1]).toMatchObject({
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
  expect(first.id).toBe(second.id);
  expect(first.worktrees[1]).toMatchObject({ path: strange, available: true });
  expect(app.inventory().projects).toHaveLength(1);
});

it('marks the old project unavailable when registering a replacement at its former path', async () => {
  const f = await fixture();
  const app = await open(f.dataDirectory);
  const original = await app.register(f.main);
  git(f.main, 'worktree', 'remove', f.linked);
  const moved = join(f.root, 'original');
  await rename(f.main, moved);
  git(f.root, 'clone', moved, f.main);
  const replacement = await app.register(f.main);
  expect(replacement.id).not.toBe(original.id);
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
