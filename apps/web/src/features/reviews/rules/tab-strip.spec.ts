import { describe, expect, it } from 'vitest';
import { parseTabLayout } from './tab-strip.ts';

describe('parseTabLayout', () => {
  it('keeps the saved panes with their known tabs and pins', () => {
    expect(
      parseTabLayout({
        panes: [
          { tabs: ['handoff', 'file:a.ts'], pinned: ['file:a.ts'] },
          { tabs: ['commit:abcd'], pinned: [] },
        ],
      }),
    ).toEqual([
      { tabs: ['handoff', 'file:a.ts'], pinned: ['file:a.ts'] },
      { tabs: ['commit:abcd'], pinned: [] },
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
