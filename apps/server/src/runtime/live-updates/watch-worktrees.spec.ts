import { describe, expect, it } from 'vitest';
import { RecordingInventoryRefresh } from '../../../spec/fakes/recording-inventory-refresh.ts';
import { InMemoryWorktreeWatcher } from '../../../spec/fakes/in-memory-worktree-watcher.ts';
import { RecordingWorktreeChanges } from '../../../spec/fakes/recording-worktree-changes.ts';
import { WatchWorktrees } from './watch-worktrees.ts';

const PROJECT = 'project-a';
const OTHER_PROJECT = 'project-b';

function settle(ms = 10): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function wish(worktreeId: string, projectId = PROJECT) {
  return { projectId, worktreeId, paths: [] };
}

function subject(limits = { maxConnections: 4, maxWatchedWorktrees: 4 }) {
  const watcher = new InMemoryWorktreeWatcher({
    worktrees: ['one', 'two', 'three'].map((worktreeId) => ({
      projectId: PROJECT,
      worktreeId,
      root: `/repositories/${worktreeId}`,
    })),
    projects: [
      { projectId: PROJECT, commonDirectory: '/repositories/one/.git' },
    ],
  });
  const events = new RecordingWorktreeChanges();
  const refresh = new RecordingInventoryRefresh();
  const watches = new WatchWorktrees(
    events,
    refresh,
    watcher,
    { failure: () => undefined },
    { ...limits, burstMs: 1, announcedEditMs: 50 },
  );
  const open = () => {
    const opened = watches.open();
    if (opened.kind !== 'opened') throw new Error('The watch was refused');
    return opened.demand;
  };
  const follow = (projects: string[], worktrees: ReturnType<typeof wish>[]) =>
    open().replace({ projects, worktrees });
  return { watches, watcher, events, refresh, follow, open };
}

describe('WatchWorktrees', () => {
  it('follows the worktrees and projects a client names when they exist', async () => {
    const { follow } = subject();
    expect(await follow([PROJECT], [wish('one'), wish('gone')])).toEqual({
      projects: [PROJECT],
      worktrees: [{ projectId: PROJECT, worktreeId: 'one' }],
    });
  });

  it('refuses a worktree named under a project it does not belong to', async () => {
    const { follow } = subject();
    const targets = await follow([], [wish('one', OTHER_PROJECT)]);
    expect(targets.worktrees).toEqual([]);
  });

  it('watches no more worktrees than its limit across clients', async () => {
    const { follow } = subject({ maxConnections: 4, maxWatchedWorktrees: 2 });
    await follow([], [wish('one')]);
    const targets = await follow([], [wish('two'), wish('three')]);
    expect(targets.worktrees).toEqual([
      { projectId: PROJECT, worktreeId: 'two' },
    ]);
  });

  it('refuses a client beyond the connection limit', () => {
    const { watches } = subject({ maxConnections: 1, maxWatchedWorktrees: 4 });
    watches.open();
    expect(watches.open()).toEqual({ kind: 'at-capacity' });
  });

  it('refuses every client once it is closed', async () => {
    const { watches } = subject();
    await watches.close();
    expect(watches.open()).toEqual({ kind: 'at-capacity' });
  });

  it('announces a burst of file changes once, with every path of the burst', async () => {
    const { follow, watcher, events } = subject();
    await follow([], [wish('one')]);
    watcher.changeFiles('one', ['src/a.ts']);
    watcher.changeFiles('one', ['src/b.ts']);
    await settle();
    expect(events.announced('one')).toEqual({
      worktreeId: 'one',
      change: 'files',
      paths: ['src/a.ts', 'src/b.ts'],
    });
  });

  it('skips a changed path that an edit already announced, and still announces the others', async () => {
    const { watches, follow, watcher, events } = subject();
    await follow([], [wish('one')]);
    watches.save({ worktreeId: 'one', paths: ['src/a.ts'] });
    watcher.changeFiles('one', ['src/a.ts', 'src/b.ts']);
    await settle();
    expect(events.announced('one')).toEqual({
      worktreeId: 'one',
      change: 'files',
      paths: ['src/b.ts'],
    });
  });

  it('reacts to nothing when every changed path was already announced by an edit', async () => {
    const { watches, follow, watcher, events } = subject();
    await follow([], [wish('one')]);
    watches.save({ worktreeId: 'one', paths: ['src/a.ts'] });
    watcher.changeFiles('one', ['src/a.ts']);
    await settle();
    expect(events.announced('one')).toBeUndefined();
  });

  it('reacts to a change of an announced path once the announcement has expired', async () => {
    const { watches, follow, watcher, events } = subject();
    await follow([], [wish('one')]);
    watches.save({ worktreeId: 'one', paths: ['src/a.ts'] });
    await settle(80);
    watcher.changeFiles('one', ['src/a.ts']);
    await settle();
    expect(events.announced('one')).toEqual({
      worktreeId: 'one',
      change: 'files',
      paths: ['src/a.ts'],
    });
  });

  it('announces a repository change to every watched worktree of the project and refreshes the inventory', async () => {
    const { follow, watcher, events, refresh } = subject();
    await follow([PROJECT], [wish('one'), wish('two')]);
    watcher.changeRepository(PROJECT);
    await settle();
    expect([events.announced('one'), events.announced('two')]).toEqual([
      { worktreeId: 'one', change: 'git' },
      { worktreeId: 'two', change: 'git' },
    ]);
    expect(refresh.isFresh()).toBe(true);
  });

  it('stops watching a worktree once no client names it', async () => {
    const { watcher, open } = subject();
    const demand = open();
    await demand.replace({ projects: [PROJECT], worktrees: [wish('one')] });
    await demand.replace({ projects: [], worktrees: [] });
    await settle();
    expect(watcher.watched()).toEqual({ worktrees: [], projects: [] });
  });
});
