import { describe, expect, it } from 'vitest';
import { InMemoryEventPublisher } from '../../spec/fakes/in-memory-event-publisher.ts';
import { InMemoryWorktreeWatcher } from '../../spec/fakes/in-memory-worktree-watcher.ts';
import { ScriptedInventoryRefresh } from '../../spec/fakes/scripted-inventory-refresh.ts';
import { ScriptedReviewedMarksInvalidation } from '../../spec/fakes/scripted-reviewed-marks-invalidation.ts';
import { WatchWorktreesJob } from './watch-worktrees-job.ts';

const PROJECT = 'project-a';
const OTHER_PROJECT = 'project-b';

function settle(ms = 10): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function subject(limits = { maxConnections: 4, maxWatchedWorktrees: 4 }) {
  const watcher = new InMemoryWorktreeWatcher();
  const events = new InMemoryEventPublisher();
  const invalidation = new ScriptedReviewedMarksInvalidation();
  const refresh = new ScriptedInventoryRefresh();
  for (const worktreeId of ['one', 'two', 'three'])
    watcher.worktrees.set(worktreeId, {
      projectId: PROJECT,
      worktreeId,
      root: `/repositories/${worktreeId}`,
    });
  watcher.projects.set(PROJECT, {
    projectId: PROJECT,
    commonDirectory: '/repositories/one/.git',
  });
  const job = new WatchWorktreesJob(
    invalidation,
    refresh,
    events,
    watcher,
    { failure: () => undefined },
    { ...limits, burstMs: 1 },
  );
  job.start();
  return { job, watcher, events, invalidation, refresh };
}

function wish(worktreeId: string, projectId = PROJECT) {
  return { projectId, worktreeId, paths: [] };
}

describe('WatchWorktreesJob', () => {
  it('follows the worktrees and projects a client names when they exist', async () => {
    const { job } = subject();
    const targets = await job
      .open()
      .replace({ projects: [PROJECT], worktrees: [wish('one'), wish('gone')] });
    expect(targets).toEqual({
      projects: [PROJECT],
      worktrees: [{ projectId: PROJECT, worktreeId: 'one' }],
    });
  });

  it('refuses a worktree named under a project it does not belong to', async () => {
    const { job } = subject();
    const targets = await job
      .open()
      .replace({ projects: [], worktrees: [wish('one', OTHER_PROJECT)] });
    expect(targets.worktrees).toEqual([]);
  });

  it('watches no more worktrees than its limit across clients', async () => {
    const { job } = subject({ maxConnections: 4, maxWatchedWorktrees: 2 });
    await job.open().replace({ projects: [], worktrees: [wish('one')] });
    const targets = await job
      .open()
      .replace({ projects: [], worktrees: [wish('two'), wish('three')] });
    expect(targets.worktrees).toEqual([
      { projectId: PROJECT, worktreeId: 'two' },
    ]);
  });

  it('refuses a client beyond the connection limit', () => {
    const { job } = subject({ maxConnections: 1, maxWatchedWorktrees: 4 });
    job.open();
    expect(() => job.open()).toThrow('Live update capacity reached');
  });

  it('announces a burst of file changes once, after the reviewed marks of those paths are invalidated', async () => {
    const { job, watcher, events, invalidation } = subject();
    await job.open().replace({ projects: [], worktrees: [wish('one')] });
    const invalidating = Promise.withResolvers<void>();
    invalidation.settled = invalidating.promise;
    watcher.fileListeners.get('one')?.(['src/a.ts']);
    watcher.fileListeners.get('one')?.(['src/b.ts']);
    await settle();
    expect(invalidation.invalidated.get('one')).toEqual([
      'src/a.ts',
      'src/b.ts',
    ]);
    expect(events.announcedFiles.get('one')).toBeUndefined();
    invalidating.resolve();
    await settle();
    expect(events.announcedFiles.get('one')).toBe(1);
  });

  it('announces a repository change to every watched worktree of the project and refreshes the inventory', async () => {
    const { job, watcher, events, refresh } = subject();
    await job
      .open()
      .replace({ projects: [PROJECT], worktrees: [wish('one'), wish('two')] });
    watcher.repositoryListeners.get(PROJECT)?.();
    await settle();
    expect(events.worktreeChanges).toEqual(
      new Map([
        ['one', 'git'],
        ['two', 'git'],
      ]),
    );
    expect(refresh.refreshes).toBe(1);
  });

  it('stops watching a worktree once no client names it', async () => {
    const { job, watcher } = subject();
    const demand = job.open();
    await demand.replace({ projects: [PROJECT], worktrees: [wish('one')] });
    await demand.replace({ projects: [], worktrees: [] });
    await settle();
    expect([...watcher.fileListeners.keys()]).toEqual([]);
    expect([...watcher.repositoryListeners.keys()]).toEqual([]);
  });
});
