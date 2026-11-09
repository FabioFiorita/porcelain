import { describe, expect, it } from 'vitest';
import {
  neighbourAfterClose,
  documentPane,
  primaryPane,
  orderedTabs,
  recentTabEntries,
  closeInPane,
  closeOthersInPane,
  closeUnpinnedInPane,
  togglePinInPane,
  openInPane,
  openToSideText,
  parseTabLayout,
  changesTabCount,
  reviewTabCount,
} from './tab-strip.ts';

describe('opening a document', () => {
  it.each([
    'handoff',
    'all-changes',
    'specs',
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
            tabs: ['file:a.ts', 'proof', 'unknown:x', 7, 'commit:zz'],
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

  it.each([
    ['handoff'],
    ['handoff', 'file:a.ts'],
    ['handoff', 'file:a.ts', 'graph'],
  ])(
    'keeps the active permanent document after a refused close: %j',
    (...tabs) => {
      const pane = { tabs, pinned: [] };
      expect(
        neighbourAfterClose(pane, 'handoff', closeInPane(pane, 'handoff')),
      ).toBe('handoff');
    },
  );

  it.each([
    {
      tabs: ['handoff', 'file:a.ts', 'graph'],
      key: 'file:a.ts',
      expected: 'graph',
    },
    { tabs: ['handoff', 'file:a.ts'], key: 'file:a.ts', expected: 'handoff' },
    { tabs: ['file:a.ts'], key: 'file:a.ts', expected: null },
  ])(
    'selects the remaining neighbour after closing $key in $tabs',
    ({ tabs, key, expected }) => {
      const pane = { tabs, pinned: [] };
      expect(neighbourAfterClose(pane, key, closeInPane(pane, key))).toBe(
        expected,
      );
    },
  );

  it('allows the last side document to close', () => {
    expect(
      closeInPane({ tabs: ['file:a.ts'], pinned: [] }, 'file:a.ts'),
    ).toEqual({ tabs: [], pinned: [] });
  });
});

describe('first tab count', () => {
  it.each([
    [0, undefined],
    [1, { value: '1', description: '1 uncommitted file' }],
    [3, { value: '3', description: '3 uncommitted files' }],
  ])('counts %i uncommitted files for Changes', (count, expected) => {
    expect(changesTabCount(count)).toEqual(expected);
  });

  it.each([
    [0, 1, { value: '0/1', description: '0 of 1 decision reviewed' }],
    [2, 9, { value: '2/9', description: '2 of 9 decisions reviewed' }],
  ])('counts %i of %i decisions for Review', (reviewed, total, expected) => {
    expect(reviewTabCount(reviewed, total)).toEqual(expected);
  });
});

describe('session tab activation order', () => {
  it('seeds a cold session from the active tab then the current tabs without reordering them', () => {
    const panes = [{ tabs: ['handoff', 'file:a.ts', 'file:b.ts'], pinned: [] }];
    expect(recentTabEntries([], panes, 'file:b.ts')).toEqual([
      'file:b.ts',
      'handoff',
      'file:a.ts',
    ]);
    expect(panes[0]?.tabs).toEqual(['handoff', 'file:a.ts', 'file:b.ts']);
  });

  it('keeps actual activation order across panes and prunes closed entries', () => {
    const panes = [
      { tabs: ['file:a.ts', 'file:c.ts'], pinned: [] },
      { tabs: ['file:b.ts'], pinned: [] },
    ];
    const order = recentTabEntries([], panes, 'file:a.ts');
    const second = recentTabEntries(order, panes, 'file:b.ts');
    const third = recentTabEntries(second, panes, 'file:c.ts');
    expect(third).toEqual(['file:c.ts', 'file:b.ts', 'file:a.ts']);
    expect(recentTabEntries(third, panes, 'file:a.ts')).toEqual([
      'file:a.ts',
      'file:c.ts',
      'file:b.ts',
    ]);
    expect(
      recentTabEntries(
        third,
        [{ tabs: ['file:a.ts'], pinned: [] }],
        'file:a.ts',
      ),
    ).toEqual(['file:a.ts']);
    expect(recentTabEntries(third, [], null)).toEqual([]);
  });

  it('keeps repeated focus idempotent and deduplicates documents shared by two panes', () => {
    const panes = [
      { tabs: ['file:a.ts', 'file:b.ts'], pinned: [] },
      { tabs: ['file:a.ts'], pinned: [] },
    ];
    const first = recentTabEntries([], panes, 'file:a.ts');
    expect(recentTabEntries(first, panes, 'file:a.ts')).toEqual([
      'file:a.ts',
      'file:b.ts',
    ]);
  });
});
