import { expect, it } from 'vitest';
import { closeDocument } from './document-tabs';
import {
  changePane,
  emptyPanes,
  focusPane,
  openInPane,
  openToSide,
  visiblePanes,
} from './document-panes';

const css = { key: 'src/app.css', title: 'app.css' };
const readme = { key: 'README.md', title: 'README.md' };
const history = { key: 'commit:abc', title: 'abc' };

it('opens to the side without replacing the source and routes later opens to the focused pane', () => {
  const first = openInPane(emptyPanes<typeof css>(), css);
  const split = openToSide(first, readme);
  const opened = openInPane(split, history);
  expect(opened).toEqual({
    left: { tabs: [css], active: 'src/app.css' },
    right: { tabs: [readme, history], active: 'commit:abc' },
    focused: 'right',
  });
  expect(openInPane(focusPane(opened, 'left'), readme).right).toEqual(
    opened.right,
  );
  expect(openToSide(split, css, 'right').left.tabs).toEqual([css]);
});

it('closes tabs in their own pane and folds only an emptied side pane', () => {
  const split = openToSide(openInPane(emptyPanes<typeof css>(), css), readme);
  const added = openInPane(split, history);
  const closed = changePane(added, 'right', (tabs) =>
    closeDocument(tabs, 'README.md'),
  );
  expect(closed.left).toEqual(split.left);
  expect(closed.right).toEqual({ tabs: [history], active: 'commit:abc' });
  expect(
    changePane(closed, 'left', (tabs) => closeDocument(tabs, 'src/app.css')),
  ).toEqual({
    left: { tabs: [], active: null },
    right: { tabs: [history], active: 'commit:abc' },
    focused: 'left',
  });
  expect(
    changePane(split, 'right', (tabs) => closeDocument(tabs, 'README.md')),
  ).toEqual({
    left: { tabs: [css], active: 'src/app.css' },
    right: null,
    focused: 'left',
  });
});

it('shows the focused pane at narrow widths and restores both without changing their tabs', () => {
  const split = openToSide(openInPane(emptyPanes<typeof css>(), css), readme);
  const landscape = (width: number) =>
    ({ width, orientation: 'landscape' }) as const;
  expect(visiblePanes(split, landscape(699))).toEqual(['right']);
  expect(visiblePanes(focusPane(split, 'left'), landscape(699))).toEqual([
    'left',
  ]);
  expect(visiblePanes(split, landscape(700))).toEqual(['left', 'right']);
  const single = emptyPanes<typeof css>();
  expect(focusPane(single, 'right')).toBe(single);
  expect(changePane(single, 'right', (tabs) => tabs)).toBe(single);
  expect(visiblePanes(single, landscape(1400))).toEqual(['left']);
});

it.each([
  { focused: 'left', shown: ['left'] },
  { focused: 'right', shown: ['right'] },
] as const)(
  'shows only the focused $focused pane in portrait however wide the page is',
  ({ focused, shown }) => {
    const split = focusPane(
      openToSide(openInPane(emptyPanes<typeof css>(), css), readme),
      focused,
    );
    expect(
      visiblePanes(split, { width: 1024, orientation: 'portrait' }),
    ).toEqual(shown);
  },
);
