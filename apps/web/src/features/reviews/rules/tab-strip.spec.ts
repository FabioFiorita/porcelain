import { describe, expect, it } from 'vitest';
import {
  documentPane,
  primaryPane,
  orderedTabs,
  closeInPane,
  closeOthersInPane,
  closeUnpinnedInPane,
  togglePinInPane,
  openInPane,
  openToSideText,
  parseTabLayout,
} from './tab-strip.ts';

describe('opening a document', () => {
  it.each([
    'handoff',
    'all-changes',
    'specs',
    'proof',
    'change:src/a.ts',
    'file:src/a.ts',
    'commit:abcd',
    'branch',
    'branch:src/a.ts',
    'graph',
    'timeline:src/a.ts',
  ])('focuses the existing %s document and adds no tab', (key) => {
    const panes = [
      { tabs: ['file:other.ts'], pinned: [] },
      { tabs: [key, 'file:last.ts'], pinned: [key] },
    ] as const;
    const target = documentPane(panes, 0, key);
    expect(target).toBe(1);
    expect(openInPane(panes[target], key, 'file:last.ts')).toEqual({
      tabs: [key, 'file:last.ts'],
      pinned: [key],
    });
    expect(panes[0]).toEqual({ tabs: ['file:other.ts'], pinned: [] });
  });

  it('prefers the requested pane when both panes intentionally contain the document', () => {
    const panes = [
      { tabs: ['file:a.ts'], pinned: [] },
      { tabs: ['file:a.ts'], pinned: [] },
    ];
    expect(documentPane(panes, 0, 'file:a.ts')).toBe(0);
    expect(documentPane(panes, 1, 'file:a.ts')).toBe(1);
  });

  it('opens a new document in the requested pane and keeps document kinds distinct', () => {
    const panes = [
      { tabs: ['file:a.ts'], pinned: [] },
      { tabs: [], pinned: [] },
    ];
    expect(documentPane(panes, 1, 'file:new.ts')).toBe(1);
    expect(documentPane(panes, 1, 'timeline:a.ts')).toBe(1);
    expect(documentPane(panes, 1, 'change:a.ts')).toBe(1);
  });
});

describe('parseTabLayout', () => {
  it('keeps the saved panes with their known tabs and pins', () => {
    expect(
      parseTabLayout({
        panes: [
          { tabs: ['handoff', 'file:a.ts'], pinned: ['file:a.ts'] },
          { tabs: ['commit:abcd', 'graph'], pinned: ['graph'] },
        ],
      }),
    ).toEqual([
      { tabs: ['handoff', 'file:a.ts'], pinned: ['file:a.ts'] },
      { tabs: ['commit:abcd', 'graph'], pinned: ['graph'] },
    ]);
  });

  it('drops unknown tabs and pins of tabs that are not open', () => {
    expect(
      parseTabLayout({
        panes: [
          {
            tabs: ['file:a.ts', 'unknown:x', 7, 'commit:zz'],
            pinned: ['file:b.ts', 'file:a.ts'],
          },
        ],
      }),
    ).toEqual([{ tabs: ['file:a.ts'], pinned: ['file:a.ts'] }]);
  });

  it('keeps an empty first pane and drops an empty second pane', () => {
    expect(
      parseTabLayout({
        panes: [
          { tabs: [], pinned: [] },
          { tabs: ['unknown:x'], pinned: [] },
        ],
      }),
    ).toEqual([{ tabs: [], pinned: [] }]);
  });

  it('reads nothing from a value that is not a saved layout', () => {
    expect([
      parseTabLayout(null),
      parseTabLayout([]),
      parseTabLayout({ panes: 'handoff' }),
      parseTabLayout({ panes: [] }),
    ]).toEqual([null, null, null, null]);
  });
});

describe('side-opening label', () => {
  it('names the destination opposite the source pane, or offers a split', () => {
    expect(openToSideText(null)).toBe('Open to the side');
    expect(openToSideText('left')).toBe('Open in the right pane');
    expect(openToSideText('right')).toBe('Open in the left pane');
  });
});

describe('permanent review tab', () => {
  it.each([
    { tabs: [], pinned: [] },
    { tabs: ['file:a.ts'], pinned: ['file:a.ts'] },
    { tabs: ['file:a.ts', 'handoff'], pinned: ['file:a.ts', 'handoff'] },
  ])('restores the first tab without losing documents or pins: %j', (saved) => {
    const restored = primaryPane(saved);
    expect(orderedTabs(restored)[0]).toBe('handoff');
    expect(restored.tabs.filter((key) => key === 'handoff')).toEqual([
      'handoff',
    ]);
    expect(restored.tabs.filter((key) => key !== 'handoff')).toEqual(
      saved.tabs.filter((key) => key !== 'handoff'),
    );
    expect(restored.pinned).toEqual(
      saved.pinned.filter((key) => key !== 'handoff'),
    );
  });

  it.each(['close', 'others', 'unpinned', 'pin'] as const)(
    'keeps Review or Changes during %s',
    (action) => {
      const pane = { tabs: ['handoff', 'file:a.ts', 'graph'], pinned: [] };
      const operations = {
        close: () => closeInPane(pane, 'handoff'),
        others: () => closeOthersInPane(pane, 'file:a.ts'),
        unpinned: () => closeUnpinnedInPane(pane),
        pin: () => togglePinInPane(pane, 'handoff'),
      };
      const next = operations[action]();
      expect(orderedTabs(next)[0]).toBe('handoff');
      expect(next.pinned).toEqual([]);
      const expected = {
        close: pane.tabs,
        others: ['handoff', 'file:a.ts'],
        unpinned: ['handoff'],
        pin: pane.tabs,
      };
      expect(next.tabs).toEqual(expected[action]);
    },
  );

  it('allows the last side document to close', () => {
    expect(
      closeInPane({ tabs: ['file:a.ts'], pinned: [] }, 'file:a.ts'),
    ).toEqual({ tabs: [], pinned: [] });
  });
});
