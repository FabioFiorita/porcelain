import type { CommitPage } from '@porcelain/git/dtos/commit-history';
import { HistoryWorktreeUnavailableError } from '@porcelain/git/errors/history-worktree-unavailable-error';
import type {
  CommitReader,
  CommitReaderFactory,
} from '@porcelain/git/interfaces/commit-reader';
import { describe, expect, it, vi } from 'vitest';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { WorktreeNotFoundError } from './errors/worktree-not-found-error.ts';
import { fakeWorktrees } from './helpers/fake-worktrees.ts';
import { ListCommits } from './list-commits.ts';
import { ReadCommitFiles } from './read-commit-files.ts';

describe('Commit history use cases', () => {
  // Projects are stored; worktrees are listed. The fixture says both apart.
  const projects = [
    {
      id: 'project',
      name: 'Project',
      namedByOwner: false,
      commonDirectory: '/fixture/.git',
      repositoryIdentity: 'repository-identity',
      available: true,
    },
  ];
  const worktree = {
    id: 'worktree',
    path: '/fixture',
    metadataIdentity: 'checkout-identity',
    repositoryIdentity: 'repository-identity',
    main: true,
    branch: 'refs/heads/main',
  };
  const page: CommitPage = {
    snapshot: {
      tipOid: null,
      head: { kind: 'unborn', ref: 'refs/heads/main' },
    },
    commits: [],
    nextAfter: null,
    tip: null,
    boundary: null,
    restarted: false,
  };
  function fixture(
    options: { projectAvailable?: boolean; worktreeAvailable?: boolean } = {},
  ) {
    const store: InventoryStore = {
      read: () => ({
        environmentId: 'environment',
        projects: projects.map((project) => ({
          ...project,
          available: options.projectAvailable ?? true,
        })),
      }),
      save: () => {
        throw new Error('History must not write inventory');
      },
    };
    const worktrees = fakeWorktrees(
      [{ ...worktree, available: options.worktreeAvailable ?? true }],
      { projectAvailable: options.projectAvailable ?? true },
    );
    const reader: CommitReader = {
      listCommits: vi.fn<CommitReader['listCommits']>().mockResolvedValue(page),
      readCommitFiles: vi
        .fn<CommitReader['readCommitFiles']>()
        .mockRejectedValue(new Error('fixture read failure')),
      readCommitDiffs: vi
        .fn<CommitReader['readCommitDiffs']>()
        .mockResolvedValue(new Map()),
    };
    const factory = vi.fn<CommitReaderFactory>(() => reader);
    return {
      factory,
      reader,
      list: new ListCommits(store, worktrees, factory),
      inspect: new ReadCommitFiles(store, worktrees, factory),
    };
  }
  it('binds reads to inventory identity and carries the selected comparison and cancellation signal', async () => {
    const f = fixture();
    const controller = new AbortController();
    expect(await f.list.execute('worktree', {}, controller.signal)).toEqual(
      page,
    );
    expect(f.factory).toHaveBeenCalledWith({
      path: '/fixture',
      commonDirectory: '/fixture/.git',
      administrativeDirectory: '/fixture/.git',
      repositoryIdentity: 'repository-identity',
      metadataIdentity: 'checkout-identity',
      scope: 'environment:project:worktree',
    });
    const request = { oid: 'a'.repeat(40), parent: 2 };
    await expect(
      f.inspect.files('worktree', request, controller.signal),
    ).rejects.toThrow('fixture read failure');
    expect(f.reader.readCommitFiles).toHaveBeenCalledWith(
      request,
      controller.signal,
    );
  });
  it('rejects unavailable worktrees before invoking Git', async () => {
    for (const unavailable of [
      { projectAvailable: false },
      { worktreeAvailable: false },
    ]) {
      const f = fixture(unavailable);
      await expect(f.list.execute('worktree', {})).rejects.toBeInstanceOf(
        HistoryWorktreeUnavailableError,
      );
      await expect(
        f.inspect.files('worktree', { oid: 'a'.repeat(40) }),
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
      f.inspect.files('worktree', { oid: 'a'.repeat(40) }, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(f.factory).not.toHaveBeenCalled();
  });

  it('reports an unknown worktree separately from unavailable inventory', async () => {
    const f = fixture();
    await expect(f.list.execute('unknown', {})).rejects.toBeInstanceOf(
      WorktreeNotFoundError,
    );
    await expect(
      f.inspect.files('unknown', { oid: 'a'.repeat(40) }),
    ).rejects.toBeInstanceOf(WorktreeNotFoundError);
    expect(f.factory).not.toHaveBeenCalled();
  });
});
