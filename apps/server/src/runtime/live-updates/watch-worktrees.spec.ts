import { describe, expect, it } from 'vitest';
import { RecordingEventPublisher } from '../../../spec/fakes/recording-event-publisher.ts';
import { RecordingInventoryRefresh } from '../../../spec/fakes/recording-inventory-refresh.ts';
import { InMemoryReviewedMarks } from '../../../spec/fakes/in-memory-reviewed-marks.ts';
import { InMemoryWorktreeWatcher } from '../../../spec/fakes/in-memory-worktree-watcher.ts';
import { WatchWorktrees } from './watch-worktrees.ts';

const PROJECT = 'project-a';
const OTHER_PROJECT = 'project-b';
const MARKED = ['src/a.ts', 'src/b.ts', 'src/c.ts'];

function settle(ms = 10): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function wish(worktreeId: string, projectId = PROJECT) {
  return { projectId, worktreeId, paths: [] };
}

function subject(
  limits = { maxConnections: 4, maxWatchedWorktrees: 4 },
  invalidated: Promise<void> = Promise.resolve(),
) {
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
  const events = new RecordingEventPublisher();
  const marks = new InMemoryReviewedMarks({ one: MARKED }, invalidated);
  const refresh = new RecordingInventoryRefresh();
  const watches = new WatchWorktrees(
    marks,
    refresh,
    events,
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
  return { watches, watcher, events, marks, refresh, follow, open };
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

  it('announces a burst of file changes once, after the reviewed marks of those paths are invalidated', async () => {
    const invalidating = Promise.withResolvers<void>();
    const { follow, watcher, events, marks } = subject(
      undefined,
      invalidating.promise,
    );
    await follow([], [wish('one')]);
    watcher.changeFiles('one', ['src/a.ts']);
    watcher.changeFiles('one', ['src/b.ts']);
    await settle();
    expect(events.announcedFiles('one')).toBeUndefined();
    invalidating.resolve();
    await settle();
    expect(marks.marksOf('one')).toEqual(['src/c.ts']);
    expect(events.announcedFiles('one')).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('skips a changed path that an edit already announced, and still announces the others', async () => {
    const { watches, follow, watcher, events, marks } = subject();
    await follow([], [wish('one')]);
    watches.save({ worktreeId: 'one', paths: ['src/a.ts'] });
    watcher.changeFiles('one', ['src/a.ts', 'src/b.ts']);
    await settle();
    expect(events.announcedFiles('one')).toEqual(['src/b.ts']);
    expect(marks.marksOf('one')).toEqual(['src/a.ts', 'src/c.ts']);
  });

  it('reacts to nothing when every changed path was already announced by an edit', async () => {
    const { watches, follow, watcher, events, marks } = subject();
    await follow([], [wish('one')]);
    watches.save({ worktreeId: 'one', paths: ['src/a.ts'] });
    watcher.changeFiles('one', ['src/a.ts']);
    await settle();
    expect(events.announcedFiles('one')).toBeUndefined();
    expect(marks.marksOf('one')).toEqual(MARKED);
  });

  it('reacts to a change of an announced path once the announcement has expired', async () => {
    const { watches, follow, watcher, events } = subject();
    await follow([], [wish('one')]);
    watches.save({ worktreeId: 'one', paths: ['src/a.ts'] });
    await settle(80);
    watcher.changeFiles('one', ['src/a.ts']);
    await settle();
    expect(events.announcedFiles('one')).toEqual(['src/a.ts']);
  });

  it('announces a repository change to every watched worktree of the project and refreshes the inventory', async () => {
    const { follow, watcher, events, refresh } = subject();
    await follow([PROJECT], [wish('one'), wish('two')]);
    watcher.changeRepository(PROJECT);
    await settle();
    expect([
      events.announcedChange('one'),
      events.announcedChange('two'),
    ]).toEqual(['git', 'git']);
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
