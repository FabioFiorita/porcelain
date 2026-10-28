import { afterAll, beforeAll, expect } from 'vitest';
import { test as it } from '@porcelain/server/kit/server-test';
import { chromium, type Browser } from 'playwright';
import type { BoardRole } from '../../web-verify/scripts/board-maps.ts';
import {
  compareRoles,
  measureRoles,
} from '../../web-verify/scripts/board-styles.ts';
import { unavailablePage } from '../../web-verify/scripts/browser.ts';

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
      gap: '6px 6px',
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
