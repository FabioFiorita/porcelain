import { expect, it, vi } from 'vitest';
import type { FileReader } from '../filesystem/interfaces/file-reader.ts';
import type { DiscoveryResult } from '../git/dtos/discovery-result.ts';
import type { GitFactory } from '../git/interfaces/git-factory.ts';
import type { Inventory } from '../models/inventory.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { ListDirectory } from './list-directory.ts';
import { ReadTextFile } from './read-text-file.ts';

function fixture() {
  const worktree = {
    id: 'worktree',
    path: '/fixture',
    main: true,
    branch: null,
    available: true,
    metadataIdentity: 'metadata',
  };
  const project = {
    id: 'project',
    name: 'fixture',
    commonDirectory: '/fixture/.git',
    repositoryIdentity: 'repository',
    available: true,
    worktrees: [worktree],
  };
  const inventory: Inventory = {
    environmentId: 'environment',
    projects: [project],
  };
  const store: InventoryStore = {
    read: () => inventory,
    save: () => {
      throw new Error('Reads must not write inventory');
    },
  };
  const discovered: DiscoveryResult = {
    repository: {
      commonDirectory: project.commonDirectory,
      repositoryIdentity: project.repositoryIdentity,
      worktrees: [{ ...worktree }],
    },
    issues: [],
  };
  const discover = vi.fn(async () => discovered);
  const git: GitFactory = () => ({ listWorktrees: discover });
  const files: FileReader = {
    list: vi.fn<FileReader['list']>(async (target) => ({
      worktreeId: target.worktreeId,
      path: target.path,
      entries: [],
    })),
    read: vi.fn<FileReader['read']>(async (target) => ({
      worktreeId: target.worktreeId,
      path: target.path,
      encoding: 'utf-8',
      byteLength: 5,
      text: 'hello',
    })),
  };
  return {
    project,
    worktree,
    discovered,
    discover,
    files,
    list: new ListDirectory(store, git, files),
    read: new ReadTextFile(store, git, files),
  };
}

it('reads only the selected registered worktree and preserves result data', async () => {
  const f = fixture();
  expect(await f.read.execute('worktree', 'src/app.ts')).toEqual({
    worktreeId: 'worktree',
    path: 'src/app.ts',
    encoding: 'utf-8',
    byteLength: 5,
    text: 'hello',
  });
  expect(f.files.read).toHaveBeenCalledWith(
    { worktreeId: 'worktree', root: '/fixture', path: 'src/app.ts' },
    undefined,
  );
  expect(await f.list.execute('worktree', '')).toEqual({
    worktreeId: 'worktree',
    path: '',
    entries: [],
  });
});

it.each([
  '../secret',
  '/absolute',
  'src/../secret',
  'a//b',
  './a',
  'a/',
  'a\\b',
  'a\0b',
  'C:/secret',
  'x'.repeat(4097),
])('rejects invalid path %s before filesystem access', async (path) => {
  const f = fixture();
  await expect(f.read.execute('worktree', path)).rejects.toMatchObject({
    code: 'INVALID_REQUEST',
  });
  expect(f.discover).not.toHaveBeenCalled();
  expect(f.files.read).not.toHaveBeenCalled();
});

it('allows the directory root but rejects empty file paths and Git metadata components', async () => {
  const f = fixture();
  await expect(f.read.execute('worktree', '')).rejects.toMatchObject({
    code: 'INVALID_REQUEST',
  });
  for (const path of ['.git/config', 'nested/.GIT', '.git']) {
    await expect(f.list.execute('worktree', path)).rejects.toMatchObject({
      code: 'PATH_NOT_READABLE',
    });
  }
});

it('rejects unknown or unavailable inventory before inspection', async () => {
  const f = fixture();
  await expect(f.list.execute('unknown', '')).rejects.toMatchObject({
    code: 'WORKTREE_NOT_FOUND',
  });
  f.project.available = false;
  await expect(f.list.execute('worktree', '')).rejects.toMatchObject({
    code: 'REPOSITORY_UNAVAILABLE',
  });
  f.project.available = true;
  f.worktree.available = false;
  await expect(f.read.execute('worktree', 'a')).rejects.toMatchObject({
    code: 'REPOSITORY_UNAVAILABLE',
  });
  expect(f.discover).not.toHaveBeenCalled();
});

it('rejects replaced repository and worktree identities without returning content', async () => {
  const f = fixture();
  f.discovered.repository.repositoryIdentity = 'replacement';
  await expect(f.read.execute('worktree', 'a')).rejects.toMatchObject({
    code: 'REPOSITORY_UNAVAILABLE',
  });
  expect(f.files.read).not.toHaveBeenCalled();
  f.discovered.repository.repositoryIdentity = 'repository';
  f.discovered.repository.worktrees[0] = {
    ...f.worktree,
    metadataIdentity: 'replacement',
  };
  await expect(f.read.execute('worktree', 'a')).rejects.toMatchObject({
    code: 'REPOSITORY_UNAVAILABLE',
  });
});

it('withholds a result if the registered checkout changes during reading', async () => {
  const f = fixture();
  vi.mocked(f.files.read).mockImplementationOnce(async () => {
    f.discovered.repository.worktrees = [];
    return {
      worktreeId: 'worktree',
      path: 'a',
      encoding: 'utf-8',
      byteLength: 6,
      text: 'secret',
    };
  });
  await expect(f.read.execute('worktree', 'a')).rejects.toMatchObject({
    code: 'REPOSITORY_UNAVAILABLE',
  });
});

it('preserves unexpected failures and cancellation', async () => {
  const f = fixture();
  const error = new Error('private diagnostics');
  f.discover.mockRejectedValueOnce(error);
  await expect(f.list.execute('worktree', '')).rejects.toBe(error);
  const controller = new AbortController();
  f.discover.mockImplementationOnce(async () => {
    controller.abort();
    throw error;
  });
  await expect(
    f.read.execute('worktree', 'a', controller.signal),
  ).rejects.toMatchObject({ name: 'AbortError' });
});
