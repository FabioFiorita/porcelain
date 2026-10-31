import { expect, test } from 'vitest';
import { AtomRegistry } from 'effect/reactivity';
import {
  fileNavigation,
  fileNavigationOffset,
  fileReadingLine,
  fileReadingStart,
} from './store';

function placeRegistry() {
  const tasks: (() => void)[] = [];
  const registry = AtomRegistry.make({
    scheduleTask: (task) => {
      tasks.push(task);
      return () => undefined;
    },
  });
  return {
    registry,
    flush: () => {
      for (const task of tasks.splice(0)) task();
    },
  };
}

test('Files place survives owner unmount and workspace switches without leaking into another workspace', () => {
  const { registry, flush } = placeRegistry();
  try {
    const first = fileNavigation('first');
    const leave = registry.mount(first);
    const offset = fileNavigationOffset('first');
    const leaveOffset = registry.mount(offset);
    registry.update(first, (current) => ({
      ...current,
      query: '.env',
      expanded: new Set(['docs']),
      requested: ['', 'docs'],
      selectedPath: 'docs/.env',
      showHidden: true,
      pinnedOpen: false,
    }));
    registry.set(offset, 450);
    leave();
    leaveOffset();
    flush();
    expect(registry.get(fileNavigationOffset('first'))).toBe(450);
    expect(registry.get(fileNavigationOffset('second'))).toBe(0);
    expect(registry.get(fileNavigation('second'))).toMatchObject({
      query: '',
      selectedPath: undefined,
    });
    expect(registry.get(fileNavigation('first'))).toMatchObject({
      query: '.env',
      expanded: new Set(['docs']),
      requested: ['', 'docs'],
      selectedPath: 'docs/.env',
      showHidden: true,
      pinnedOpen: false,
    });
  } finally {
    registry.dispose();
  }
});

test('plain file reading lines survive unmount and remain scoped to workspace and path', () => {
  const { registry, flush } = placeRegistry();
  try {
    const atom = fileReadingLine({ workspace: 'first', path: 'docs/long.ts' });
    const leave = registry.mount(atom);
    registry.set(atom, 350);
    leave();
    flush();
    expect(
      registry.get(
        fileReadingLine({ workspace: 'first', path: 'docs/long.ts' }),
      ),
    ).toBe(350);
    expect(
      registry.get(
        fileReadingLine({ workspace: 'second', path: 'docs/long.ts' }),
      ),
    ).toBe(1);
    expect(
      registry.get(fileReadingLine({ workspace: 'first', path: 'other.ts' })),
    ).toBe(1);
  } finally {
    registry.dispose();
  }
});

test('replacing live source starts at the latest reading line without subscribing the reader to scrolling', () => {
  const { registry } = placeRegistry();
  const input = { workspace: 'first', path: 'docs/long.ts' };
  const start = fileReadingStart({ ...input, source: 'Original source' });
  const changes: number[] = [];
  const stop = registry.subscribe(start, (line) => changes.push(line), {
    immediate: true,
  });
  try {
    registry.set(fileReadingLine(input), 350);
    expect(changes).toEqual([1]);
    expect(
      registry.get(fileReadingStart({ ...input, source: 'Updated source' })),
    ).toBe(350);
  } finally {
    stop();
    registry.dispose();
  }
});
