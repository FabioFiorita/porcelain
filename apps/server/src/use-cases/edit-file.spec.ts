import { expect, it } from 'vitest';
import type { FileWriter } from '../filesystem/interfaces/file-writer.ts';
import { EditFile } from './edit-file.ts';
import { fakeWorktrees } from './helpers/fake-worktrees.ts';

const worktree = {
  id: 'worktree',
  path: '/fixture',
  metadataIdentity: 'identity',
  main: true,
};

/**
 * A mutation reports which worktree it happened in, and that has to be the
 * worktree the request named. It cannot undo the change — nothing can — but
 * reporting a write against a checkout that has since been replaced would
 * attribute it to a repository it never touched.
 */
it('refuses to report a change against a checkout that was replaced while it ran', async () => {
  let reachable = true;
  const writes: string[] = [];
  const files: FileWriter = {
    edit: async (_root, command) => {
      // The checkout stops being the registered one while the write runs.
      reachable = false;
      writes.push(command.path);
      return { path: command.path };
    },
  };
  const edit = new EditFile(
    fakeWorktrees([worktree], { projectAvailable: () => reachable }),
    files,
  );
  await expect(
    edit.execute('worktree', {
      kind: 'create',
      path: 'src/new.ts',
      entryKind: 'file',
    }),
  ).rejects.toMatchObject({ code: 'REPOSITORY_UNAVAILABLE' });
  // It really did run; what is refused is calling it this worktree's change.
  expect(writes).toEqual(['src/new.ts']);
});

it('reports a change when the checkout is still the one that was named', async () => {
  const files: FileWriter = {
    edit: async (_root, command) => ({ path: command.path }),
  };
  const edit = new EditFile(fakeWorktrees([worktree]), files);
  await expect(
    edit.execute('worktree', { kind: 'trash', path: 'src/old.ts' }),
  ).resolves.toEqual({ path: 'src/old.ts' });
});

it('refuses a path that leaves the worktree before touching the filesystem', async () => {
  const files: FileWriter = {
    edit: async () => {
      throw new Error('Must not reach the filesystem');
    },
  };
  const edit = new EditFile(fakeWorktrees([worktree]), files);
  for (const path of ['../outside', '/tmp/outside'])
    await expect(
      edit.execute('worktree', { kind: 'create', path, entryKind: 'file' }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
});
