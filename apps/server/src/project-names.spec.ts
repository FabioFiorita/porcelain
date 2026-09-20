import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
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

async function repository(name: string, origin?: string) {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-names-'));
  roots.push(root);
  const checkout = join(root, name);
  await mkdir(checkout);
  git(checkout, 'init', '-b', 'main');
  git(checkout, 'commit', '--allow-empty', '-m', 'Fixture');
  if (origin) git(checkout, 'remote', 'add', 'origin', origin);
  return { root, checkout, dataDirectory: join(root, 'state') };
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

it('names a project after the repository in its origin, whatever the folder is called', async () => {
  const f = await repository(
    'checked-out-here',
    'git@github.com:owner/atlas.git',
  );
  const app = await open(f.dataDirectory);
  expect((await app.register(f.checkout)).project.name).toBe('atlas');
});

it('names a project after its own checkout folder when there is no origin', async () => {
  const f = await repository('atlas-without-origin');
  const app = await open(f.dataDirectory);
  expect((await app.register(f.checkout)).project.name).toBe(
    'atlas-without-origin',
  );
});

it('follows a changed origin until the owner names it themselves', async () => {
  const f = await repository('folder', 'git@github.com:owner/first.git');
  const app = await open(f.dataDirectory);
  const { project } = await app.register(f.checkout);
  expect(project.name).toBe('first');
  // A name nobody chose is data: registering again picks up a repository that
  // has moved host or been renamed.
  git(
    f.checkout,
    'remote',
    'set-url',
    'origin',
    'git@github.com:owner/second.git',
  );
  expect((await app.register(f.checkout)).project.name).toBe('second');
  expect(await app.renameProject(project.id, '  Atlas review  ')).toEqual({
    id: project.id,
    name: 'Atlas review',
  });
  // Once it is theirs, nothing derives over it.
  git(
    f.checkout,
    'remote',
    'set-url',
    'origin',
    'git@github.com:owner/third.git',
  );
  expect((await app.register(f.checkout)).project.name).toBe('Atlas review');
  await app.close();
  applications.splice(applications.indexOf(app), 1);
  const restarted = await open(f.dataDirectory);
  expect((await restarted.inventory()).inventory.projects[0]?.name).toBe(
    'Atlas review',
  );
});

it('refuses a name that is blank or carries control characters', async () => {
  const f = await repository('folder', 'git@github.com:owner/atlas.git');
  const app = await open(f.dataDirectory);
  const { project } = await app.register(f.checkout);
  for (const name of ['   ', 'two\nlines', `bell${String.fromCodePoint(7)}`])
    await expect(app.renameProject(project.id, name)).rejects.toThrow();
  expect((await app.inventory()).inventory.projects[0]?.name).toBe('atlas');
});
