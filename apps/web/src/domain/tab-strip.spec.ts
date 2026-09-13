import { describe, expect, it } from 'vitest';
import {
  closeInPane,
  closeOthersInPane,
  neighbourAfterClose,
  openInPane,
  orderedTabs,
  togglePinInPane,
} from './tab-strip';

describe('tab strip rules', () => {
  it('keeps pinned tabs first without losing their open order', () => {
    const pane = { tabs: ['file:a', 'file:b', 'file:c'], pinned: ['file:c'] };
    expect(orderedTabs(pane)).toEqual(['file:c', 'file:a', 'file:b']);
    expect(openInPane(pane, 'file:b', 'file:a')).toEqual(pane);
  });

  it('selects the right neighbour, then the left neighbour after close', () => {
    const before = {
      tabs: ['file:a', 'file:b', 'file:c'],
      pinned: [],
    };
    expect(
      neighbourAfterClose(before, 'file:b', closeInPane(before, 'file:b')),
    ).toBe('file:c');
    expect(
      neighbourAfterClose(before, 'file:c', closeInPane(before, 'file:c')),
    ).toBe('file:b');
  });

  it('keeps pinned tabs when closing others and toggles pin membership', () => {
    const pane = { tabs: ['handoff', 'file:a', 'file:b'], pinned: ['handoff'] };
    expect(closeOthersInPane(pane, 'file:b').tabs).toEqual([
      'handoff',
      'file:b',
    ]);
    expect(togglePinInPane(pane, 'file:a').pinned).toEqual([
      'handoff',
      'file:a',
    ]);
  });
});
