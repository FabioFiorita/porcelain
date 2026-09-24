import { WorktreeChangedError } from '@porcelain/kernel/errors';
import type {
  CatalogProject,
  ListedWorktree,
} from '@porcelain/projects/models';
import { ConfirmWorktreeService } from '@porcelain/projects/services';
import { describe, expect, it } from 'vitest';
import { InMemoryWorktreeCatalogStore } from '../../spec/fakes/in-memory-worktree-catalog-store.ts';
import { Lanes } from './lanes.ts';

const worktree: ListedWorktree = {
  id: 'worktree-1',
  projectId: 'project-1',
  path: '/srv/api',
  branch: 'refs/heads/main',
  main: true,
  available: true,
  metadataIdentity: 'metadata-1',
  administrativeDirectory: '/srv/api/.git',
  commonDirectory: '/srv/api/.git',
  repositoryIdentity: 'repository-1',
  repositoryId: 'repository-1',
};

function listed(worktrees: ListedWorktree[]): { projects: CatalogProject[] } {
  return {
    projects: [
      {
        observation: {
          id: 'project-1',
          commonDirectory: '/srv/api/.git',
          repositoryIdentity: 'repository-1',
          observedAt: '2026-09-24T12:00:00.000Z',
          listed: true,
        },
        worktrees,
      },
    ],
  };
}

function lanes(catalog = new InMemoryWorktreeCatalogStore()) {
  return new Lanes({
    deadlineMs: 1000,
    readCapacity: 4,
    consistency: new ConfirmWorktreeService(catalog),
  });
}

describe('Lanes', () => {
  it('runs background work in its lane after the write that holds the lane', async () => {
    const subject = lanes();
    const order: string[] = [];
    const holding = Promise.withResolvers<void>();
    const write = subject.run('repository', 'write', async () => {
      await holding.promise;
      order.push('write');
    });
    subject.background(
      'repository',
      async () => {
        order.push('background');
      },
      { onFailure: () => order.push('failed') },
    );
    holding.resolve();
    await write;
    await subject.close();
    expect(order).toEqual(['write', 'background']);
  });

  it('hands a failed background work to its failure handler once, and closing waits for both', async () => {
    const subject = lanes();
    const failures: unknown[] = [];
    const cause = new Error('Git failed');
    subject.background(
      'repository',
      async () => {
        throw cause;
      },
      { onFailure: (error) => failures.push(error) },
    );
    await subject.close();
    expect(failures).toEqual([cause]);
  });

  it('runs work handed to finish after closing began, and closing waits for it', async () => {
    const subject = lanes();
    const release = Promise.withResolvers<void>();
    const recorded: string[] = [];
    void subject.finish(
      async () => {
        await release.promise;
        recorded.push('before close');
      },
      { lane: 'first' },
    );
    const closing = subject.close();
    void subject.finish(async () => recorded.push('after close'), {
      lane: 'second',
    });
    release.resolve();
    await closing;
    expect(recorded.toSorted()).toEqual(['after close', 'before close']);
  });

  it('runs finish work in its lane only after the work that holds the lane, even while closing', async () => {
    const subject = lanes();
    const order: string[] = [];
    const holding = Promise.withResolvers<void>();
    const write = subject.run('repository', 'write', async () => {
      await holding.promise;
      order.push('write');
    });
    const finished = subject.finish(async () => order.push('finish'), {
      lane: 'repository',
    });
    const closing = subject.close();
    holding.resolve();
    await write.catch(() => undefined);
    await finished;
    await closing;
    expect(order).toEqual(['write', 'finish']);
  });

  it('answers a consistent read when the worktree is still the one checked after the work', async () => {
    const catalog = new InMemoryWorktreeCatalogStore();
    catalog.save(listed([worktree]));
    const subject = lanes(catalog);
    await expect(
      subject.runConsistent('repository', worktree, async () => 'status'),
    ).resolves.toBe('status');
    await subject.close();
  });

  it('refuses a consistent read whose worktree moved while the work ran', async () => {
    const catalog = new InMemoryWorktreeCatalogStore();
    catalog.save(listed([worktree]));
    const subject = lanes(catalog);
    await expect(
      subject.runConsistent('repository', worktree, async () => {
        catalog.save(listed([{ ...worktree, path: '/srv/api-moved' }]));
        return 'status';
      }),
    ).rejects.toThrow(WorktreeChangedError);
    await subject.close();
  });

  it('refuses a consistent read whose worktree disappeared while the work ran', async () => {
    const catalog = new InMemoryWorktreeCatalogStore();
    catalog.save(listed([worktree]));
    const subject = lanes(catalog);
    await expect(
      subject.runConsistent('repository', worktree, async () => {
        catalog.save(listed([]));
        return 'status';
      }),
    ).rejects.toThrow(WorktreeChangedError);
    await subject.close();
  });

  it('starts a consistent read only after the write that holds its lane', async () => {
    const catalog = new InMemoryWorktreeCatalogStore();
    catalog.save(listed([worktree]));
    const subject = lanes(catalog);
    const order: string[] = [];
    const holding = Promise.withResolvers<void>();
    const write = subject.run('repository', 'write', async () => {
      await holding.promise;
      order.push('write');
    });
    const read = subject.runConsistent('repository', worktree, async () => {
      order.push('read');
    });
    holding.resolve();
    await Promise.all([write, read]);
    await subject.close();
    expect(order).toEqual(['write', 'read']);
  });

  it('refuses unqueued work past its deadline even when the work ignores its signal', async () => {
    const subject = lanes();
    const release = Promise.withResolvers<string>();
    await expect(
      subject.unqueued(() => release.promise, { deadlineMs: 5 }),
    ).rejects.toBeInstanceOf(DOMException);
    release.resolve('late');
    await subject.close();
  });

  it('hands background work past its deadline to the failure handler', async () => {
    const subject = lanes();
    const failed = Promise.withResolvers<unknown>();
    subject.background(
      'repository',
      ({ signal }) =>
        new Promise<void>((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(signal.reason)),
        ),
      { deadlineMs: 5, onFailure: (error) => failed.resolve(error) },
    );
    expect(await failed.promise).toBeInstanceOf(DOMException);
    await subject.close();
  });
});
