import { afterAll, beforeAll, expect } from 'vitest';
import { test as it } from '@porcelain/server/kit/server-test';
import { chromium, type Browser } from 'playwright';
import {
  boards,
  type BoardRole,
  type BoardMap,
} from '../../web-verify/scripts/board-maps.ts';
import {
  compareRoles,
  measureRoles,
} from '../../web-verify/scripts/board-styles.ts';
import { unavailablePage } from '../../web-verify/scripts/browser.ts';
import { revealBoardRoles } from '../../web-verify/scripts/board-diff.ts';

function mappedRoles(name: string) {
  const map = boards[name];
  if (map === undefined) throw new Error(`The ${name} board map must exist`);
  return map.roles;
}

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

const roles: BoardRole[] = [
  { role: 'row title', board: { selector: 'h2' }, app: { selector: 'h2' } },
];
const html = (text: string, extra = '') =>
  `<style>h2 {font:500 13px/17px sans-serif;letter-spacing:0;color:rgb(98,98,107);padding:4px 8px;border-radius:7px;display:flex;gap:6px;height:28px;box-sizing:border-box;${extra}}</style><h2>${text}<svg width="12" height="12"></svg></h2>`;

it('measures the same role with different wording and detects a real style change', async () => {
  const board = await browser.newPage();
  const app = await browser.newPage();
  try {
    await board.setContent(html('Board words'));
    await app.setContent(html('Different fixture title'));
    const expected = await measureRoles(board, roles, 'board');
    const samples = await measureRoles(app, roles, 'app');
    expect(samples[0]?.styles).toStrictEqual({
      fontSize: '13px',
      lineHeight: '17px',
      fontWeight: '500',
      letterSpacing: '0px',
      colour: '#62626b',
      padding: '4px 8px 4px 8px',
      radius: '7px 7px 7px 7px',
      gap: '0px 6px',
      height: '28.000px',
      icon: 'present',
    });
    expect(compareRoles(expected, samples).every((row) => row.match)).toBe(
      true,
    );
    await app.setContent(html('Different fixture title', 'font-size:15px;'));
    expect(
      compareRoles(expected, await measureRoles(app, roles, 'app')).filter(
        (row) => !row.match,
      ),
    ).toStrictEqual([
      {
        role: 'row title',
        property: 'fontSize',
        board: '13px',
        app: '15px',
        match: false,
      },
    ]);
  } finally {
    await app.close();
    await board.close();
  }
});

it.each([
  ['', 'selector matched 0 elements (expected one)'],
  ['<h2>one</h2><h2>two</h2>', 'selector matched 2 elements (expected one)'],
  ['<h2 hidden>hidden</h2>', 'element is hidden or has no size'],
  [
    '<div hidden><h2>hidden ancestor</h2></div>',
    'element is hidden or has no size',
  ],
])(
  'fails missing, ambiguous and hidden roles: %s',
  async (content, problem) => {
    const page = await browser.newPage();
    try {
      await page.setContent(content);
      const samples = await measureRoles(page, roles, 'app');
      expect(samples[0]?.problem).toBe(problem);
      expect(compareRoles(samples, samples)[0]?.match).toBe(false);
    } finally {
      await page.close();
    }
  },
);

it.each([
  'Page not found',
  'Computer unavailable',
  'Worktree not found',
  'Revision not found',
  'Could not display the workspace',
  'Could not display',
])('rejects an HTTP-200 %s screen', async (title) => {
  const page = await browser.newPage();
  try {
    await page.setContent(
      `<section data-slot="state-notice"><h2>${title}</h2></section>`,
    );
    expect(await unavailablePage(page)).toBe(title);
  } finally {
    await page.close();
  }
});

it('ignores unavailable words in ordinary headings, prose, computer names and hidden notices', async () => {
  const page = await browser.newPage();
  try {
    await page.setContent(
      '<section data-slot="state-notice" hidden><h2>Page not found</h2></section><p>Computer unavailable</p><h1>Page not found</h1><nav><span data-slot="breadcrumb-page">Computer unavailable</span></nav>',
    );
    expect(await unavailablePage(page)).toBeUndefined();
  } finally {
    await page.close();
  }
});

it('selects the visible responsive role when the desktop copy is hidden', async () => {
  const page = await browser.newPage();
  try {
    await page.setContent('<h2 hidden>desktop</h2><h2>phone</h2>');
    const samples = await measureRoles(page, roles, 'app');
    expect(samples[0]?.problem).toBeUndefined();
    expect(samples[0]?.styles.fontWeight).toBe('700');
  } finally {
    await page.close();
  }
});

it('rejects a removed computer notice beside the Settings breadcrumb', async () => {
  const page = await browser.newPage();
  try {
    await page.setContent(
      '<nav><span data-slot="breadcrumb-page">Computer unavailable</span></nav><h1>Computers</h1><div data-unavailable-page="Computer unavailable">This computer is no longer saved on this app.</div>',
    );
    expect(await unavailablePage(page)).toBe('Computer unavailable');
  } finally {
    await page.close();
  }
});

it.each([
  ['', 'removed'],
  ['<svg width="12" height="0"></svg>', 'zero height'],
  ['<svg width="0" height="12"></svg>', 'zero width'],
  ['<svg style="opacity:0" width="12" height="12"></svg>', 'transparent'],
  ['<svg style="display:none" width="12" height="12"></svg>', 'hidden'],
])('reports an absent icon when %s (%s)', async (icon) => {
  const board = await browser.newPage();
  const app = await browser.newPage();
  try {
    await board.setContent(html('A control'));
    await app.setContent(
      html('A control').replace('<svg width="12" height="12"></svg>', icon),
    );
    const rows = compareRoles(
      await measureRoles(board, roles, 'board'),
      await measureRoles(app, roles, 'app'),
    );
    expect(rows.filter((row) => !row.match)).toStrictEqual([
      {
        role: 'row title',
        property: 'icon',
        board: 'present',
        app: 'absent',
        match: false,
      },
    ]);
  } finally {
    await app.close();
    await board.close();
  }
});

it('compares mapped text properties without treating different wrapping as a height defect', async () => {
  const board = await browser.newPage();
  const app = await browser.newPage();
  const textRoles: BoardRole[] = [
    {
      role: 'title',
      properties: [
        'fontSize',
        'lineHeight',
        'fontWeight',
        'letterSpacing',
        'colour',
      ],
      board: { selector: 'h2' },
      app: { selector: 'h2' },
    },
  ];
  try {
    await board.setContent(
      '<h2 style="font:500 13px/17px sans-serif;width:90px">Short title</h2>',
    );
    await app.setContent(
      '<h2 style="font:500 13px/17px sans-serif;width:90px">A much longer fixture title that wraps</h2>',
    );
    const expected = await measureRoles(board, textRoles, 'board');
    expect(
      compareRoles(expected, await measureRoles(app, textRoles, 'app')),
    ).toStrictEqual([
      {
        role: 'title',
        property: 'fontSize',
        board: '13px',
        app: '13px',
        match: true,
      },
      {
        role: 'title',
        property: 'lineHeight',
        board: '17px',
        app: '17px',
        match: true,
      },
      {
        role: 'title',
        property: 'fontWeight',
        board: '500',
        app: '500',
        match: true,
      },
      {
        role: 'title',
        property: 'letterSpacing',
        board: '0px',
        app: '0px',
        match: true,
      },
      {
        role: 'title',
        property: 'colour',
        board: '#000000',
        app: '#000000',
        match: true,
      },
    ]);
    await app.setContent(
      '<h2 style="font:500 15px/17px sans-serif;width:90px">A much longer fixture title that wraps</h2>',
    );
    expect(
      compareRoles(expected, await measureRoles(app, textRoles, 'app')).filter(
        (row) => !row.match,
      ),
    ).toStrictEqual([
      {
        role: 'title',
        property: 'fontSize',
        board: '13px',
        app: '15px',
        match: false,
      },
    ]);
  } finally {
    await app.close();
    await board.close();
  }
});

it('compares rendered rounded corners rather than oversized CSS radius values', async () => {
  const board = await browser.newPage();
  const app = await browser.newPage();
  try {
    await board.setContent(
      html('A control', 'width:80px;border-radius:999px;'),
    );
    await app.setContent(
      html('A control', 'width:80px;border-radius:33554400px;'),
    );
    const expected = await measureRoles(board, roles, 'board');
    expect(expected[0]?.styles.radius).toBe('14px 14px 14px 14px');
    expect(
      compareRoles(expected, await measureRoles(app, roles, 'app')).every(
        (row) => row.match,
      ),
    ).toBe(true);
    await app.addStyleTag({ content: 'h2 { border-radius:7px; }' });
    expect(
      compareRoles(expected, await measureRoles(app, roles, 'app')).filter(
        (row) => !row.match,
      ),
    ).toStrictEqual([
      {
        role: 'row title',
        property: 'radius',
        board: '14px 14px 14px 14px',
        app: '7px 7px 7px 7px',
        match: false,
      },
    ]);
  } finally {
    await app.close();
    await board.close();
  }
});

it('does not compare a nowrap flex row gap that cannot separate children', async () => {
  const board = await browser.newPage();
  const app = await browser.newPage();
  try {
    await board.setContent(html('A control'));
    await app.setContent(html('A control', 'row-gap:22px;'));
    expect(
      compareRoles(
        await measureRoles(board, roles, 'board'),
        await measureRoles(app, roles, 'app'),
      ).every((row) => row.match),
    ).toBe(true);
    await app.addStyleTag({ content: 'h2 { column-gap:12px; }' });
    expect(
      compareRoles(
        await measureRoles(board, roles, 'board'),
        await measureRoles(app, roles, 'app'),
      ).filter((row) => !row.match),
    ).toStrictEqual([
      {
        role: 'row title',
        property: 'gap',
        board: '0px 6px',
        app: '0px 12px',
        match: false,
      },
    ]);
  } finally {
    await app.close();
    await board.close();
  }
});

it('limits explicitly desktop-only roles without suppressing a hidden applicable role', async () => {
  const page = await browser.newPage();
  const desktop: BoardRole[] = [
    {
      role: 'desktop label',
      board: { selector: 'h2' },
      app: { selector: 'h2' },
      minWidth: 768,
    },
  ];
  try {
    await page.setContent(
      '<h2 hidden>Desktop label replaced by a phone icon</h2>',
    );
    expect(await measureRoles(page, desktop, 'app', 414)).toStrictEqual([]);
    expect((await measureRoles(page, desktop, 'app', 1440))[0]?.problem).toBe(
      'element is hidden or has no size',
    );
  } finally {
    await page.close();
  }
});

it('reveals a phone panel and its tab without toggling an already visible target closed', async () => {
  const page = await browser.newPage();
  const map: Pick<BoardMap, 'reveal'> = {
    reveal: [
      { target: '#panel', trigger: '#open' },
      { target: '#history', trigger: '#tab' },
    ],
  };
  try {
    await page.setContent(
      '<button id="open" onclick="panel.hidden=!panel.hidden">Review</button><aside id="panel" hidden><button id="tab" onclick="historyContent.hidden=false">History</button><h2 id="historyContent" hidden><span id="history">History heading</span></h2></aside>',
    );
    await revealBoardRoles(page, map);
    expect(await page.locator('#history').isVisible()).toBe(true);
    await revealBoardRoles(page, map);
    expect(await page.locator('#panel').isVisible()).toBe(true);
  } finally {
    await page.close();
  }
});

it('the commit title map measures the heading itself', async () => {
  const page = await browser.newPage();
  try {
    await page.setContent(
      '<section aria-label="Review content"><h1>Commit subject</h1></section>',
    );
    const roles = mappedRoles('commit').filter(
      (role) => role.role === 'commit title',
    );
    const samples = await measureRoles(page, roles, 'app');
    expect(samples[0]?.problem).toBeUndefined();
    expect(samples[0]?.styles.fontWeight).toBe('700');
  } finally {
    await page.close();
  }
});

it('the History map compares the selected commit after the uncommitted row', async () => {
  const board = await browser.newPage();
  const app = await browser.newPage();
  try {
    await board.setContent(
      '<ol aria-label="Commits"><li style="height:32px"><a><span>Uncommitted changes</span></a></li><li style="height:44px"><a aria-current="true"><span style="font:600 13px/18px sans-serif">Selected commit</span></a></li></ol>',
    );
    await app.setContent(
      '<ol aria-label="Commits"><li style="height:44px"><button><span data-slot="tooltip-trigger" style="font:600 13px/18px sans-serif">Selected commit</span></button></li></ol>',
    );
    const roles = mappedRoles('history').filter(
      (role) => role.role !== 'history heading',
    );
    const rows = compareRoles(
      await measureRoles(board, roles, 'board'),
      await measureRoles(app, roles, 'app'),
    );
    expect(rows.every((row) => row.match)).toBe(true);
  } finally {
    await board.close();
    await app.close();
  }
});

it('the graph map compares row height only in the column layout', async () => {
  const board = await browser.newPage();
  const app = await browser.newPage();
  try {
    await board.setContent(
      '<ol aria-label="Commit graph"><li style="height:30px">Commit</li></ol>',
    );
    await app.setContent(
      '<ol aria-label="Commit graph"><li style="height:44px">Commit</li></ol>',
    );
    const roles = mappedRoles('graph').filter(
      (role) => role.role !== 'HEAD ref',
    );
    const narrow = compareRoles(
      await measureRoles(board, roles, 'board', 414),
      await measureRoles(app, roles, 'app', 414),
    );
    const wide = compareRoles(
      await measureRoles(board, roles, 'board', 1440),
      await measureRoles(app, roles, 'app', 1440),
    );
    expect(narrow.every((row) => row.match)).toBe(true);
    expect(wide.find((row) => row.property === 'height')?.match).toBe(false);
  } finally {
    await board.close();
    await app.close();
  }
});
