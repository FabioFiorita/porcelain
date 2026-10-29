import { AtomRegistry } from 'effect/reactivity';
import { expect, it } from 'vitest';
import { worktreeNavigatorState } from './worktree-navigator.ts';

it.each([
  {
    name: 'search and intersecting project/computer filters',
    query: 'Dispatch Desk',
    filter: { projects: ['computer/project'], environments: ['computer'] },
  },
  {
    name: 'an empty project selection',
    query: '',
    filter: { projects: [], environments: undefined },
  },
  {
    name: 'long search and an empty computer selection',
    query: 'a very long worktree path/'.repeat(40),
    filter: { projects: undefined, environments: [] },
  },
  {
    name: 'cleared search and filters',
    query: '',
    filter: { projects: undefined, environments: undefined },
  },
])('retains $name when the navigator unmounts', ({ name, ...state }) => {
  const scheduled = new Set<() => void>();
  const registry = AtomRegistry.make({
    scheduleTask: (task) => {
      scheduled.add(task);
      return () => scheduled.delete(task);
    },
  });
  try {
    const unmount = registry.mount(worktreeNavigatorState);
    registry.set(worktreeNavigatorState, state);
    unmount();
    for (const task of scheduled) {
      scheduled.delete(task);
      task();
    }
    const remount = registry.mount(worktreeNavigatorState);
    expect(registry.get(worktreeNavigatorState)).toEqual(state);
    remount();
  } finally {
    registry.dispose();
  }
});

it('starts a new client session with unfiltered active worktrees', () => {
  const first = AtomRegistry.make();
  const next = AtomRegistry.make();
  try {
    first.set(worktreeNavigatorState, {
      query: 'old search',
      filter: { projects: [], environments: [] },
    });
    expect(next.get(worktreeNavigatorState)).toEqual({
      query: '',
      filter: { projects: undefined, environments: undefined },
    });
  } finally {
    first.dispose();
    next.dispose();
  }
});
