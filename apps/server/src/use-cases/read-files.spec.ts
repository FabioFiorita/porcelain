import { describe, expect, it, vi } from 'vitest';
import type { FileReader } from '../filesystem/interfaces/file-reader.ts';
import { fakeWorktrees } from './helpers/fake-worktrees.ts';
import { ListDirectory } from './list-directory.ts';
import { ReadTextFile } from './read-text-file.ts';

describe('ReadFiles', () => {
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
    };
    // What Git lists right now. A test changes this to express a worktree
    // being replaced, or disappearing while a read is in flight.
    let listed = [{ ...worktree }];
    const worktrees = fakeWorktrees(() => listed, {
      projectAvailable: () => project.available,
    });
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
      files,
      replace: (next: typeof listed) => {
        listed = next;
      },
      list: new ListDirectory(worktrees, files),
      read: new ReadTextFile(worktrees, files),
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
      contentFingerprint:
        '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
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
    f.replace([{ ...f.worktree, available: false }]);
    await expect(f.read.execute('worktree', 'a')).rejects.toMatchObject({
      code: 'REPOSITORY_UNAVAILABLE',
    });
    expect(f.files.read).not.toHaveBeenCalled();
  });

  it('rejects replaced repository and worktree identities without returning content', async () => {
    const f = fixture();
    // A worktree whose checkout cannot be read is refused before any content
    // is produced, and so is one whose identity no longer derives to this id.
    f.replace([{ ...f.worktree, available: false }]);
    await expect(f.read.execute('worktree', 'a')).rejects.toMatchObject({
      code: 'REPOSITORY_UNAVAILABLE',
    });
    expect(f.files.read).not.toHaveBeenCalled();
    f.replace([{ ...f.worktree, id: 'replacement' }]);
    await expect(f.read.execute('worktree', 'a')).rejects.toMatchObject({
      code: 'WORKTREE_NOT_FOUND',
    });
    expect(f.files.read).not.toHaveBeenCalled();
  });

  it('withholds a result if the registered checkout changes during reading', async () => {
    const f = fixture();
    vi.mocked(f.files.read).mockImplementationOnce(async () => {
      // The checkout is swapped while the bytes are being read: the result
      // must be withheld rather than returned from a worktree that is gone.
      f.replace([]);
      return {
        worktreeId: 'worktree',
        path: 'a',
        encoding: 'utf-8',
        byteLength: 6,
        text: 'secret',
      };
    });
    await expect(f.read.execute('worktree', 'a')).rejects.toMatchObject({
      code: 'WORKTREE_NOT_FOUND',
    });
  });

  it('preserves unexpected failures and cancellation', async () => {
    const f = fixture();
    // A failure from the filesystem is not laundered into an inspection
    // error, and cancellation still wins over whatever else went wrong.
    const error = new Error('private diagnostics');
    vi.mocked(f.files.list).mockRejectedValueOnce(error);
    await expect(f.list.execute('worktree', '')).rejects.toBe(error);
    // A request cancelled while its bytes were being read reports the
    // cancellation, and never returns the content it had already gathered.
    const controller = new AbortController();
    vi.mocked(f.files.read).mockImplementationOnce(async () => {
      controller.abort();
      return {
        worktreeId: 'worktree',
        path: 'a',
        encoding: 'utf-8' as const,
        byteLength: 6,
        text: 'secret',
      };
    });
    await expect(
      f.read.execute('worktree', 'a', controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
