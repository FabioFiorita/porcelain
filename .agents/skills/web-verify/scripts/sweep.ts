import { chromium, type Browser, type Page } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { pairingLink } from '@porcelain/contracts/access';
import { readPublishedReviewResponseSchema } from '@porcelain/contracts/reviews';
import { Schema } from 'effect';
import { ServerHandle } from '@porcelain/server/kit/isolated-server';
import type { Session } from '@porcelain/server/kit/session';
import {
  seedStressSample,
  stressVariants,
} from '@porcelain/server/kit/stress-sample';
import { Refusal, Usage } from '../../verify-core/cli.ts';
import { issuedLink } from '../../verify-core/fixtures.ts';
import { registry, type WebInstance } from './instance.ts';

const sweepWidths = [1440, 1080, 414] as const;
const sweepThemes = ['light', 'dark'] as const;
const sweepStates = ['as-is', ...stressVariants] as const;
const heights = { 1440: 900, 1080: 810, 414: 896 } as const;
const settleMs = 5000;
const pairedMs = 30_000;
const features = new URL('../features/', import.meta.url);

type Width = (typeof sweepWidths)[number];
type Theme = (typeof sweepThemes)[number];
type State = (typeof sweepStates)[number];
type Target = { entry: string; board?: string };
type Review = { reviewId?: string | undefined; layerId?: string | undefined };
type Shot = {
  entry: string;
  state: State;
  theme: Theme;
  width: Width;
  path?: string;
  file?: string;
  problems: string[];
  skipped?: string;
};

function sweepTargets(args: readonly string[]): Target[] {
  const { tokens } = parseArgs({
    args: [...args],
    options: {
      instance: { type: 'string' },
      board: { type: 'string', multiple: true },
    },
    allowPositionals: true,
    strict: true,
    tokens: true,
  });
  const targets: Target[] = [];
  const command = tokens.findIndex((item) => item.kind === 'positional');
  for (const token of tokens.filter((_, at) => at !== command)) {
    if (token.kind === 'positional') targets.push({ entry: token.value });
    if (token.kind !== 'option' || token.name !== 'board') continue;
    const last = targets.at(-1);
    if (last === undefined || last.board !== undefined)
      throw new Usage('--board <png> follows the one route it compares.');
    if (token.value === undefined || !token.value.endsWith('.png'))
      throw new Usage('--board takes a PNG board.');
    if (!existsSync(token.value))
      throw new Usage(`The board ${token.value} does not exist.`);
    last.board = token.value;
  }
  if (targets.length === 0)
    throw new Usage(
      'Name at least one route (/settings/general) or feature map (reviews.page).',
    );
  return targets;
}

function darkBoard(board: string): string | undefined {
  const stem = board.slice(0, -'.png'.length);
  return [`${stem}-D.png`, `${stem}-dark.png`].find((file) => existsSync(file));
}

function mapRoute(entry: string): string {
  const file = new URL(`${entry}.md`, features);
  if (!/^[a-z-]+\.[a-z-]+$/.test(entry) || !existsSync(file))
    throw new Usage(
      `${entry} is neither a route starting with / nor a feature map in features/.`,
    );
  const route = /^route:\s*(\S+)\s*$/m.exec(readFileSync(file, 'utf8'))?.[1];
  if (route === undefined)
    throw new Usage(`The feature map ${entry} names no route.`);
  return route;
}

function resolved(
  instance: WebInstance,
  entry: string,
  review: Review,
): string | { skipped: string } {
  if (entry.startsWith('/')) return entry;
  const values: Record<string, string | undefined> = {
    projectId: instance.detail.projectId,
    worktreeId: instance.detail.worktreeId,
    environmentId: instance.detail.environmentId,
    reviewId: review.reviewId,
    layerId: review.layerId,
  };
  const route = mapRoute(entry);
  const missing = [...route.matchAll(/\$(\w*)/g)]
    .map((match) => match[1] ?? '')
    .filter((name) => values[name] === undefined);
  if (missing.some((name) => name !== 'reviewId' && name !== 'layerId'))
    throw new Usage(
      `${entry} routes to ${route}; pass a concrete path for ${missing.map((name) => `$${name}`).join(', ')}.`,
    );
  if (missing.length > 0)
    return { skipped: 'no review is published in this state' };
  return route.replace(/\$(\w+)/g, (_, name: string) => values[name] ?? '');
}

async function sessionOf(instance: WebInstance) {
  const handle = await ServerHandle.attach(instance.detail.manifest);
  const recorder = registry.redactor(instance).recorder();
  recorder.secret(handle.credential);
  recorder.secret(handle.desktopCredential);
  return handle.session(recorder, {
    projectId: instance.detail.projectId,
    worktreeId: instance.detail.worktreeId,
  });
}

async function latestReview(session: Session): Promise<Review> {
  const response = await session.read(
    { method: 'GET', path: `/api/worktrees/${session.worktreeId}/review` },
    200,
  );
  const { review } = Schema.decodeUnknownSync(
    readPublishedReviewResponseSchema,
  )(response.body);
  return { reviewId: review?.reviewId, layerId: review?.layers[0]?.id };
}

async function pair(page: Page, instance: WebInstance) {
  const grant = await issuedLink(
    instance.detail.manifest,
    'Sweep browser',
    false,
    registry.redactor(instance).recorder(),
  );
  await page.goto(
    `${instance.detail.web}${pairingLink({ addresses: [''], code: grant.code, environmentId: grant.environmentId })}`,
  );
  await page.waitForURL((url) => url.pathname !== '/pair' && url.hash === '', {
    timeout: pairedMs,
  });
}

const layoutScript = `(() => {
  const root = document.documentElement;
  const width = root.clientWidth;
  const scrollWidth = Math.max(root.scrollWidth, document.body.scrollWidth);
  const past = (element) => element.getBoundingClientRect().right > width + 1;
  const offenders = scrollWidth > width
    ? [...document.body.querySelectorAll('*')]
        .filter((element) => past(element) && (element.parentElement === null || !past(element.parentElement)))
        .slice(0, 5)
        .map((element) => {
          const label = element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 60) ?? '';
          return '<' + element.tagName.toLowerCase() + '> "' + label + '" ends at ' + Math.round(element.getBoundingClientRect().right) + ' px';
        })
    : [];
  return { width, scrollWidth, dark: root.classList.contains('dark'), offenders };
})()`;
const layoutSchema = Schema.Struct({
  width: Schema.Number,
  scrollWidth: Schema.Number,
  dark: Schema.Boolean,
  offenders: Schema.Array(Schema.String),
});
const settledScript =
  'document.fonts.ready.then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))';
const imagesLoadedScript =
  '[...document.images].every((image) => image.complete)';

async function shoot(
  page: Page,
  url: string,
  shot: Shot,
  file: string,
): Promise<void> {
  const record = (problem: string) => shot.problems.push(problem);
  const onPageError = (error: Error) =>
    record(`page error: ${error.message.split('\n')[0] ?? ''}`);
  const onConsole = (message: { type(): string; text(): string }) => {
    if (message.type() === 'error') record(`console error: ${message.text()}`);
  };
  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  try {
    await page.setViewportSize({
      width: shot.width,
      height: heights[shot.width],
    });
    await page.emulateMedia({
      colorScheme: shot.theme,
      reducedMotion: 'reduce',
    });
    const response = await page.goto(url, { waitUntil: 'load' });
    if (response !== null && !response.ok())
      record(`the page answered HTTP ${response.status()}`);
    await page
      .waitForLoadState('networkidle', { timeout: settleMs })
      .catch(() => undefined);
    await page.evaluate(settledScript);
    const layout = Schema.decodeUnknownSync(layoutSchema)(
      await page.evaluate(layoutScript),
    );
    if (layout.scrollWidth > layout.width)
      record(
        `overflows horizontally: ${layout.scrollWidth} px of content in ${layout.width} px${layout.offenders.length > 0 ? ` (${layout.offenders.join('; ')})` : ''}`,
      );
    if (layout.dark !== (shot.theme === 'dark'))
      record(`the ${shot.theme} theme did not apply`);
    await page.screenshot({ path: file, fullPage: true });
    shot.file = file;
  } finally {
    page.off('pageerror', onPageError);
    page.off('console', onConsole);
  }
}

function escaped(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('"', '&quot;');
}

async function composite(
  browser: Browser,
  capture: string,
  board: string,
  caption: string,
  file: string,
) {
  const image = async (path: string) =>
    `data:image/png;base64,${(await readFile(path)).toString('base64')}`;
  const page = await browser.newPage({
    viewport: { width: 2400, height: 800 },
  });
  try {
    await page.setContent(
      `<!doctype html><body style="margin:0;padding:24px;display:flex;gap:24px;align-items:flex-start;background:#f4f4f5;font:16px system-ui;color:#18181b">${[
        [`Capture · ${caption}`, await image(capture)],
        [`Board · ${basename(board)}`, await image(board)],
      ]
        .map(
          ([title, source]) =>
            `<figure style="flex:1;margin:0"><figcaption style="margin-bottom:8px">${escaped(title ?? '')}</figcaption><img style="width:100%;border:1px solid #d4d4d8" src="${source}"></figure>`,
        )
        .join('')}</body>`,
    );
    await page.waitForFunction(imagesLoadedScript);
    await page.screenshot({ path: file, fullPage: true });
  } finally {
    await page.close();
  }
}

function slug(entry: string, index: number) {
  const name = entry.replace(/^\/+/, '').replace(/[^a-zA-Z0-9.]+/g, '-');
  return `${String(index + 1).padStart(2, '0')}-${name || 'root'}`;
}

function indexOf(
  instance: WebInstance,
  folder: string,
  targets: readonly Target[],
  shots: readonly Shot[],
  composites: readonly { entry: string; file: string }[],
  seeds: readonly unknown[],
) {
  const link = (file: string) => relative(folder, file);
  const problems = shots.flatMap((shot) =>
    shot.problems.map(
      (problem) =>
        `- \`${shot.path ?? shot.entry}\` ${shot.state} ${shot.theme} ${shot.width}: ${problem}`,
    ),
  );
  const cell = (shot: Shot | undefined) =>
    shot === undefined
      ? '—'
      : shot.skipped !== undefined
        ? `skipped: ${shot.skipped}`
        : shot.file === undefined
          ? 'not captured'
          : `[${shot.problems.length === 0 ? 'pass' : 'problem'}](${link(shot.file)})`;
  const sections = targets.map((target) => {
    const rows = sweepStates.flatMap((state) =>
      sweepThemes.map(
        (theme) =>
          `| ${state} | ${theme} | ${sweepWidths
            .map((width) =>
              cell(
                shots.find(
                  (shot) =>
                    shot.entry === target.entry &&
                    shot.state === state &&
                    shot.theme === theme &&
                    shot.width === width,
                ),
              ),
            )
            .join(' | ')} |`,
      ),
    );
    const paths = [
      ...new Set(
        shots
          .filter((shot) => shot.entry === target.entry && shot.path)
          .map((shot) => `\`${shot.path}\``),
      ),
    ];
    const boards = composites
      .filter((item) => item.entry === target.entry)
      .map((item) => `![${basename(item.file)}](${link(item.file)})`);
    return [
      `## ${target.entry}`,
      '',
      `Route: ${paths.join(', ') || 'not resolved'}${target.board === undefined ? '' : ` · board ${basename(target.board)}`}`,
      '',
      `| State | Theme | ${sweepWidths.join(' | ')} |`,
      `| --- | --- | ${sweepWidths.map(() => '---').join(' | ')} |`,
      ...rows,
      ...(boards.length > 0 ? ['', ...boards] : []),
    ].join('\n');
  });
  return `${[
    '# Web sweep',
    '',
    `Instance ${instance.id} · ${instance.detail.desktop ? 'desktop' : 'web'} mode · ${new Date().toISOString()}`,
    '',
    `States in order: ${sweepStates.join(', ')}. The seeds stay on the instance; restart it for a clean preview.`,
    '',
    `Seeds: \`${JSON.stringify(seeds)}\``,
    '',
    '## Problems',
    '',
    ...(problems.length === 0 ? ['None.'] : problems),
    '',
    ...sections,
  ].join('\n')}\n`;
}

export async function sweep(
  instance: WebInstance,
  args: readonly string[],
): Promise<string> {
  const targets = sweepTargets(args);
  for (const target of targets)
    resolved(instance, target.entry, { reviewId: '', layerId: '' });
  const evidence = registry.evidence(instance);
  const record = await evidence.claim('sweep', 'json');
  const folder = record.replace(/\.json$/, '');
  const shots: Shot[] = [];
  const composites: { entry: string; file: string }[] = [];
  const seeds: unknown[] = [];
  const browser = await chromium.launch();
  try {
    const page = await (
      await browser.newContext({ reducedMotion: 'reduce' })
    ).newPage();
    await pair(page, instance);
    const session = await sessionOf(instance);
    for (const state of sweepStates) {
      if (state !== 'as-is') seeds.push(await seedStressSample(session, state));
      const review = await latestReview(session);
      for (const [index, target] of targets.entries()) {
        const path = resolved(instance, target.entry, review);
        const directory = join(folder, slug(target.entry, index), state);
        if (typeof path === 'string')
          await mkdir(directory, { recursive: true, mode: 0o700 });
        for (const theme of sweepThemes)
          for (const width of sweepWidths) {
            const shot: Shot = {
              entry: target.entry,
              state,
              theme,
              width,
              problems: [],
            };
            shots.push(shot);
            if (typeof path !== 'string') {
              shot.skipped = path.skipped;
              continue;
            }
            shot.path = path;
            await shoot(
              page,
              new URL(path, instance.detail.web).href,
              shot,
              join(directory, `${theme}-${width}.png`),
            ).catch((error: unknown) => {
              shot.problems.push(
                `not captured: ${error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error)}`,
              );
            });
          }
        const boards = [
          ['light', target.board],
          ['dark', target.board && darkBoard(target.board)],
        ] as const;
        for (const [theme, board] of state === 'as-is' ? boards : []) {
          const shot = shots.find(
            (item) =>
              item.entry === target.entry &&
              item.state === state &&
              item.theme === theme &&
              item.width === 1440,
          );
          if (board === undefined || shot?.file === undefined) continue;
          const file = join(directory, `board-${theme}-1440.png`);
          await composite(
            browser,
            shot.file,
            board,
            `${shot.path ?? target.entry} · ${theme} · 1440`,
            file,
          );
          composites.push({ entry: target.entry, file });
        }
      }
    }
  } finally {
    await browser.close();
  }
  const index = join(folder, 'index.md');
  await writeFile(
    index,
    registry
      .redactor(instance)
      .text(indexOf(instance, folder, targets, shots, composites, seeds)),
    { mode: 0o600 },
  );
  const problems = shots.reduce((sum, shot) => sum + shot.problems.length, 0);
  await writeFile(
    record,
    registry.redactor(instance).text(
      `${JSON.stringify(
        {
          command: args,
          index,
          seeds,
          shots: shots.map((shot) => ({
            ...shot,
            file: shot.file && relative(folder, shot.file),
          })),
        },
        null,
        2,
      )}\n`,
    ),
    { mode: 0o600 },
  );
  const captured = shots.filter((shot) => shot.file !== undefined).length;
  if (problems > 0)
    throw new Refusal(
      `The sweep found ${problems} problem${problems === 1 ? '' : 's'} in ${captured} captures; read ${index}`,
    );
  return `swept ${captured} captures with no problems\nindex ${index}\n`;
}
