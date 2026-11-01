import { expect, test } from 'vitest';
import { scheduledRegistry } from '../../../spec/kit/atom-registry';
import { fileNavigation, fileNavigationOffset } from './store';

test('Files place survives owner unmount and workspace switches without leaking into another workspace', () => {
  const { registry, flush } = scheduledRegistry();
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
    });
  } finally {
    registry.dispose();
  }
});
