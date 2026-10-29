import { afterAll, beforeAll, expect } from 'vitest';
import { test as it } from '@porcelain/server/kit/server-test';
import { chromium, type Browser } from 'playwright';
import type {
  BoardRole,
  BoardMap,
} from '../../web-verify/scripts/board-maps.ts';
import {
  compareRoles,
  measureRoles,
} from '../../web-verify/scripts/board-styles.ts';
import { unavailablePage } from '../../web-verify/scripts/browser.ts';
import { revealBoardRoles } from '../../web-verify/scripts/board-diff.ts';

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
    await page.setContent(`<h2>${title}</h2>`);
    expect(await unavailablePage(page)).toBe(title);
  } finally {
    await page.close();
  }
});

it('ignores unavailable words in review prose and hidden headings', async () => {
  const page = await browser.newPage();
  try {
    await page.setContent(
      '<h2 hidden>Page not found</h2><p>Computer unavailable</p><h1>A real review</h1>',
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

it('rejects an unavailable computer shown in the Settings breadcrumb', async () => {
  const page = await browser.newPage();
  try {
    await page.setContent(
      '<nav><span data-slot="breadcrumb-page">Computer unavailable</span></nav><h1>Computers</h1>',
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

it('accepts a difference produced by the pinned primitive and fails one the app adds', async () => {
  const board = await browser.newPage();
  const app = await browser.newPage();
  const stockRoles: BoardRole[] = [
    {
      role: 'Git button',
      stock: 'button',
      properties: ['height', 'lineHeight', 'padding'],
      board: { selector: 'button' },
      app: { selector: 'button' },
    },
    {
      role: 'Git button label',
      stock: 'button',
      properties: ['lineHeight'],
      board: { selector: 'button' },
      app: { selector: 'button > span' },
    },
  ];
  const styles =
    '<style>button{font:500 12px/16px sans-serif;padding:0 10px;height:26px;border:0}.h-6{height:24px}.leading-relaxed{line-height:19.5px}.px-2{padding-left:8px;padding-right:8px}.h-7{height:28px}.hidden{display:none}.md\\:inline-flex{display:inline-flex}</style>';
  const source = () => ['inline-flex', 'h-6', 'px-2', 'leading-relaxed'];
  try {
    await board.setContent(`${styles}<button>Commit</button>`);
    const expected = await measureRoles(board, stockRoles, 'board');
    await app.setContent(
      `${styles}<button class="hidden md:inline-flex h-6 px-2 leading-relaxed"><span>Commit</span></button>`,
    );
    expect(
      compareRoles(
        expected,
        await measureRoles(app, stockRoles, 'app', 1440, source),
      ).map(({ role, property, match, accepted }) => ({
        role,
        property,
        match,
        accepted,
      })),
    ).toStrictEqual([
      {
        role: 'Git button',
        property: 'height',
        match: false,
        accepted: 'stock (accepted): `h-6` from the pinned button.tsx',
      },
      {
        role: 'Git button',
        property: 'lineHeight',
        match: false,
        accepted:
          'stock (accepted): `leading-relaxed` from the pinned button.tsx',
      },
      {
        role: 'Git button',
        property: 'padding',
        match: false,
        accepted: 'stock (accepted): `px-2` from the pinned button.tsx',
      },
      {
        role: 'Git button label',
        property: 'lineHeight',
        match: false,
        accepted:
          'stock (accepted): `leading-relaxed` from the pinned button.tsx',
      },
    ]);
    await app.setContent(
      `${styles}<button class="inline-flex h-7 px-2 leading-relaxed"><span class="hidden">Commit</span></button>`,
    );
    expect(
      compareRoles(
        expected,
        await measureRoles(app, stockRoles, 'app', 1440, source),
      ).filter((row) => row.accepted === undefined && !row.match),
    ).toStrictEqual([
      {
        role: 'Git button',
        property: 'height',
        board: '26.000px',
        app: '28.000px',
        match: false,
      },
      {
        role: 'Git button label',
        property: 'element',
        board: 'present',
        app: 'element is hidden or has no size',
        match: false,
      },
    ]);
  } finally {
    await app.close();
    await board.close();
  }
});

it('accepts a box style the primitive leaves unset unless an app class sets it', async () => {
  const board = await browser.newPage();
  const app = await browser.newPage();
  const switchRoles: BoardRole[] = [
    {
      role: 'review view switch',
      stock: 'tabs',
      properties: ['gap'],
      board: { selector: 'div' },
      app: { selector: 'div' },
    },
  ];
  const styles =
    '<style>div{display:flex;flex-wrap:wrap}.gap-0\\.5{gap:2px}.gap-3{gap:12px}</style>';
  const source = () => ['inline-flex', 'rounded-lg'];
  try {
    await board.setContent(
      `${styles}<div class="gap-0.5"><b>a</b><b>b</b></div>`,
    );
    const expected = await measureRoles(board, switchRoles, 'board');
    await app.setContent(
      `${styles}<div class="inline-flex rounded-lg"><b>a</b><b>b</b></div>`,
    );
    expect(
      compareRoles(
        expected,
        await measureRoles(app, switchRoles, 'app', 1440, source),
      )[0]?.accepted,
    ).toBe(
      'stock (accepted): the pinned tabs.tsx; no class the app adds changes it',
    );
    await app.setContent(
      `${styles}<div class="inline-flex rounded-lg gap-3"><b>a</b><b>b</b></div>`,
    );
    expect(
      compareRoles(
        expected,
        await measureRoles(app, switchRoles, 'app', 1440, source),
      )[0],
    ).toStrictEqual({
      role: 'review view switch',
      property: 'gap',
      board: '2px 2px',
      app: '12px 12px',
      match: false,
    });
  } finally {
    await app.close();
    await board.close();
  }
});
