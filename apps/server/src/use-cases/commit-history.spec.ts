import type { CommitPage } from '@porcelain/git/dtos/commit-history';
import { HistoryWorktreeUnavailableError } from '@porcelain/git/errors/history-worktree-unavailable-error';
import type {
  CommitReader,
  CommitReaderFactory,
} from '@porcelain/git/interfaces/commit-reader';
import { expect, it, vi } from 'vitest';
import type { Inventory } from '../models/inventory.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { WorktreeNotFoundError } from './errors/worktree-not-found-error.ts';
import { InspectCommitChanges } from './inspect-commit-changes.ts';
import { ListCommits } from './list-commits.ts';

const inventory: Inventory = {
  environmentId: 'environment',
  projects: [
    {
      id: 'project',
      name: 'Project',
      commonDirectory: '/fixture/.git',
      repositoryIdentity: 'repository-identity',
      available: true,
      worktrees: [
        {
          id: 'worktree',
          path: '/fixture',
          metadataIdentity: 'checkout-identity',
          available: true,
          main: true,
          branch: 'refs/heads/main',
        },
      ],
    },
  ],
};
const page: CommitPage = {
  snapshot: { tipOid: null, head: { kind: 'unborn', ref: 'refs/heads/main' } },
  commits: [],
  nextCursor: null,
  boundary: null,
};
function fixture(value: Inventory = inventory) {
  const store: InventoryStore = {
    read: () => value,
    save: () => {
      throw new Error('History must not write inventory');
    },
  };
  const reader: CommitReader = {
    listCommits: vi.fn<CommitReader['listCommits']>().mockResolvedValue(page),
    inspectCommitChanges: vi
      .fn<CommitReader['inspectCommitChanges']>()
      .mockRejectedValue(new Error('fixture read failure')),
  };
  const factory = vi.fn<CommitReaderFactory>(() => reader);
  return {
    factory,
    reader,
    list: new ListCommits(store, factory),
    inspect: new InspectCommitChanges(store, factory),
  };
}
it('binds reads to inventory identity and carries the selected comparison and cancellation signal', async () => {
  const f = fixture();
  const controller = new AbortController();
  expect(await f.list.execute('worktree', {}, controller.signal)).toEqual(page);
  expect(f.factory).toHaveBeenCalledWith({
    path: '/fixture',
    repositoryIdentity: 'repository-identity',
    metadataIdentity: 'checkout-identity',
    scope: 'environment:project:worktree',
  });
  const request = { oid: 'a'.repeat(40), parent: 2 };
  await expect(
    f.inspect.execute('worktree', request, controller.signal),
  ).rejects.toThrow('fixture read failure');
  expect(f.reader.inspectCommitChanges).toHaveBeenCalledWith(
    request,
    controller.signal,
  );
});
it('rejects unavailable worktrees before invoking Git', async () => {
  for (const unavailable of [
    {
      ...inventory,
      projects: inventory.projects.map((project) => ({
        ...project,
        available: false,
      })),
    },
    {
      ...inventory,
      projects: inventory.projects.map((project) => ({
        ...project,
        worktrees: project.worktrees.map((worktree) => ({
          ...worktree,
          available: false,
        })),
      })),
    },
    {
      ...inventory,
      projects: inventory.projects.map((project) => ({
        ...project,
        worktrees: project.worktrees.map((worktree) => ({
          ...worktree,
          metadataIdentity: null,
        })),
      })),
    },
  ]) {
    const f = fixture(unavailable);
    await expect(f.list.execute('worktree', {})).rejects.toBeInstanceOf(
      HistoryWorktreeUnavailableError,
    );
    await expect(
      f.inspect.execute('worktree', { oid: 'a'.repeat(40) }),
    ).rejects.toBeInstanceOf(HistoryWorktreeUnavailableError);
    expect(f.factory).not.toHaveBeenCalled();
  }
});
it('does not start Git after cancellation', async () => {
  const f = fixture();
  const controller = new AbortController();
  controller.abort();
  await expect(
    f.list.execute('worktree', {}, controller.signal),
  ).rejects.toMatchObject({ name: 'AbortError' });
  await expect(
    f.inspect.execute('worktree', { oid: 'a'.repeat(40) }, controller.signal),
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(f.factory).not.toHaveBeenCalled();
});

it('reports an unknown worktree separately from unavailable inventory', async () => {
  const f = fixture({ ...inventory, projects: [] });
  await expect(f.list.execute('unknown', {})).rejects.toBeInstanceOf(
    WorktreeNotFoundError,
  );
  await expect(
    f.inspect.execute('unknown', { oid: 'a'.repeat(40) }),
  ).rejects.toBeInstanceOf(WorktreeNotFoundError);
  expect(f.factory).not.toHaveBeenCalled();
});
