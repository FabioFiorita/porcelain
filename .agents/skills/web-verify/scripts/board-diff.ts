import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { Schema } from 'effect';
import { boards, type BoardMap } from './board-maps.ts';
import { Refusal, Usage } from '../../verify-core/cli.ts';
import { firstLine } from './attempts.ts';
import { pair, settledText, unavailablePage } from './browser.ts';
import {
  compareRoles,
  measureRoles,
  styleTable,
  type StyleRow,
} from './board-styles.ts';
import { registry, type WebInstance } from './instance.ts';
import type { BrowserDocument, BrowserHtmlElement } from './browser-dom.ts';

declare const document: BrowserDocument;
declare const HTMLElement: new () => BrowserHtmlElement;

type Theme = 'light' | 'dark';
type Capture = {
  width: number;
  theme: Theme;
  rows: StyleRow[];
  problems: string[];
};

export function boardDiffOptions(args: readonly string[]) {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    strict: true,
    options: {
      instance: { type: 'string' },
      board: { type: 'string' },
      route: { type: 'string' },
      width: { type: 'string', default: '1440,414' },
      theme: { type: 'string', default: 'light,dark' },
      'board-directory': { type: 'string' },
    },
  });
  if (
    positionals.length !== 1 ||
    positionals[0] !== 'board-diff' ||
    !values.board ||
    !values.route
  )
    throw new Usage(
      'board-diff requires --board <name> and --route <app route>.',
    );
  const name = values.board;
  const route = values.route;
  if (
    !route.startsWith('/') ||
    route.startsWith('//') ||
    new URL(route, 'http://localhost').origin !== 'http://localhost'
  )
    throw new Usage('--route must be a path on the running app.');
  const widths = values.width.split(',').map(Number);
  if (
    widths.length === 0 ||
    widths.some(
      (width) => !Number.isInteger(width) || width < 320 || width > 3840,
    )
  )
    throw new Usage(
      '--width takes comma-separated integer widths from 320 to 3840.',
    );
  const themes = values.theme.split(',').map((theme): Theme => {
    if (theme !== 'light' && theme !== 'dark')
      throw new Usage('--theme takes light,dark.');
    return theme;
  });
  const board =
    (Object.hasOwn(boards, name) ? boards[name] : undefined) ??
    Object.values(boards).find(
      (map) => map.html === `${name.replace(/\.html$/, '')}.html`,
    );
  if (board === undefined)
    throw new Usage(
      `Unknown board ${values.board}. Choose ${Object.keys(boards).join(', ')}.`,
    );
  const directory =
    values['board-directory'] ?? process.env.PORCELAIN_BOARD_DIRECTORY;
  if (!directory)
    throw new Usage(
      'Set PORCELAIN_BOARD_DIRECTORY or pass --board-directory <folder> containing the approved HTML boards.',
    );
  const html = resolve(directory, board.html);
  if (!existsSync(html)) throw new Usage(`Board HTML is missing: ${html}`);
  return {
    name,
    board,
    directory: resolve(directory),
    route,
    widths: [...new Set(widths)],
    themes: [...new Set(themes)],
  };
}

async function boardPage(
  browser: Browser,
  map: BoardMap,
  directory: string,
  width: number,
  theme: Theme,
): Promise<Page> {
  const stem = map.html.replace(/\.html$/, '');
  const nativeDark = [map.dark, `${stem}-D.html`, `${stem}-dark.html`].find(
    (file) => file !== undefined && existsSync(join(directory, file)),
  );
  const file =
    theme === 'dark' && nativeDark !== undefined ? nativeDark : map.html;
  const page = await browser.newPage({
    viewport: { width, height: 900 },
    colorScheme: theme,
  });
  try {
    await page.goto(pathToFileURL(join(directory, file)).href);
    if (theme === 'dark' && nativeDark === undefined) {
      const palette = join(directory, 'Narrative-desktop-dark.html');
      if (!existsSync(palette))
        throw new Refusal(
          'No dark sibling or Narrative-desktop-dark.html palette exists for this board.',
        );
      const source = await browser.newPage();
      try {
        await source.goto(pathToFileURL(palette).href);
        const tokens = Schema.decodeUnknownSync(
          Schema.Record(Schema.String, Schema.String),
        )(
          await source.evaluate(() => {
            const root = document.body.firstElementChild;
            if (!(root instanceof HTMLElement))
              throw new Error('The palette has no HTML root.');
            return Object.fromEntries(
              [...root.style]
                .filter((name) => name.startsWith('--'))
                .map((name) => [name, root.style.getPropertyValue(name)]),
            );
          }),
        );
        if (Object.keys(tokens).length === 0)
          throw new Refusal('The dark board palette contains no tokens.');
        await page.evaluate((tokens) => {
          const root = document.body.firstElementChild;
          if (!(root instanceof HTMLElement))
            throw new Error('The board has no HTML root.');
          for (const [name, value] of Object.entries(tokens))
            root.style.setProperty(name, value);
          root.style.colorScheme = 'dark';
        }, tokens);
      } finally {
        await source.close();
      }
    }
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    return page;
  } catch (error) {
    await page.close();
    throw error;
  }
}

async function capture(
  browser: Browser,
  signed: Awaited<ReturnType<BrowserContext['storageState']>>,
  instance: WebInstance,
  options: ReturnType<typeof boardDiffOptions>,
  width: number,
  theme: Theme,
  folder: string,
): Promise<Capture> {
  const found: Capture = { width, theme, rows: [], problems: [] };
  const context = await browser.newContext({
    storageState: signed,
    viewport: { width, height: width < 768 ? 896 : 900 },
    colorScheme: theme,
    reducedMotion: 'reduce',
  });
  try {
    const page = await context.newPage();
    page.on('pageerror', (error) =>
      found.problems.push(`page error: ${firstLine(error)}`),
    );
    page.on('console', (message) => {
      if (message.type() === 'error')
        found.problems.push(`console error: ${message.text()}`);
    });
    const url = new URL(options.route, instance.detail.web);
    const response = await page.goto(url.href);
    if (response === null || !response.ok())
      found.problems.push(
        `document HTTP ${response?.status() ?? 'no response'}`,
      );
    await page
      .waitForLoadState('networkidle', { timeout: 20_000 })
      .catch(() => found.problems.push('network did not go idle within 20 s'));
    const text = await settledText(page);
    if (!text?.trim())
      found.problems.push('page text is empty or did not settle');
    if (page.url() !== url.href)
      found.problems.push(`route changed from ${url.pathname}${url.search}`);
    const unavailable = await unavailablePage(page);
    if (unavailable !== undefined)
      found.problems.push(`unavailable page: ${unavailable}`);
    const dark =
      (await page.locator('html').getAttribute('class'))
        ?.split(' ')
        .includes('dark') ?? false;
    if (dark !== (theme === 'dark'))
      found.problems.push(`${theme} theme did not apply`);
    if (width < 768 && options.board.phoneOpen !== undefined) {
      await page.locator(options.board.phoneOpen).first().click();
      await settledText(page);
    }
    const board = await boardPage(
      browser,
      options.board,
      options.directory,
      width,
      theme,
    );
    try {
      found.rows = compareRoles(
        await measureRoles(board, options.board.roles, 'board'),
        await measureRoles(page, options.board.roles, 'app'),
      );
      await board.screenshot({
        path: join(folder, `board-${theme}-${width}.png`),
        fullPage: true,
      });
      await page.screenshot({
        path: join(folder, `app-${theme}-${width}.png`),
        fullPage: true,
      });
    } finally {
      await board.close();
    }
  } catch (error) {
    found.problems.push(firstLine(error));
  } finally {
    await context.close();
  }
  return found;
}

export async function boardDiff(
  instance: WebInstance,
  args: readonly string[],
): Promise<string> {
  const options = boardDiffOptions(args);
  const redactor = registry.redactor(instance);
  const recorder = redactor.recorder();
  const record = await registry.evidence(instance).claim('board-diff', 'json');
  const folder = record.replace(/\.json$/, '');
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const captures: Capture[] = [];
  const problems: string[] = [];
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch();
    const pairing = await browser.newContext();
    let signed;
    try {
      await pair(await pairing.newPage(), instance, recorder);
      signed = await pairing.storageState();
    } finally {
      await pairing.close();
    }
    for (const width of options.widths)
      for (const theme of options.themes)
        captures.push(
          await capture(
            browser,
            signed,
            instance,
            options,
            width,
            theme,
            folder,
          ),
        );
  } catch (error) {
    problems.push(firstLine(error));
  } finally {
    await browser?.close();
  }
  const mismatches = captures.flatMap((item) =>
    item.rows.filter((row) => !row.match),
  ).length;
  const failures =
    problems.length +
    captures.reduce((sum, item) => sum + item.problems.length, 0) +
    mismatches;
  const markdown = [
    `# Board comparison: ${options.name}`,
    '',
    `Route: \`${options.route}\``,
    '',
    'Tolerance: 0.5 px per length; 1 per RGB/alpha channel. Weight and icon presence must match exactly.',
    '',
    ...problems.map((problem) => `- ${problem}`),
    ...captures.flatMap((item) => [
      `## ${item.width} · ${item.theme}`,
      '',
      ...item.problems.map((problem) => `- ${problem}`),
      '',
      styleTable(item.rows),
      '',
    ]),
    `Result: ${failures === 0 ? 'PASS' : 'FAIL'} · ${mismatches} mismatched properties · ${failures - mismatches} capture problems.`,
    '',
  ].join('\n');
  const safe = (text: string) => {
    const clean = redactor.text(recorder.scrub(text));
    return recorder.leaks(clean) > 0
      ? 'Record withheld because a secret survived redaction.'
      : clean;
  };
  const index = join(folder, 'index.md');
  await writeFile(index, safe(markdown), { mode: 0o600 });
  await writeFile(
    record,
    safe(
      JSON.stringify(
        {
          instance: instance.id,
          fingerprint: instance.fingerprint,
          board: options.name,
          route: options.route,
          html: options.board.html,
          captures,
          problems,
          mismatches,
          pass: failures === 0,
          index,
        },
        null,
        2,
      ),
    ),
    { mode: 0o600 },
  );
  const output = `${safe(markdown)}\nindex ${index}\njson ${record}\n`;
  if (failures > 0) throw new Refusal(output);
  return output;
}
