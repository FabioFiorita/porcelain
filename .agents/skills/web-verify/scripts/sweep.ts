import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { pairingLink } from '@porcelain/contracts/access';
import { readPublishedReviewResponseSchema } from '@porcelain/contracts/reviews';
import { Schema } from 'effect';
import {
  type Recorder,
  ServerHandle,
} from '@porcelain/server/kit/isolated-server';
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
const networkIdleMs = 20_000;
const settledMs = 15_000;
const stableReads = 3;
const readEveryMs = 200;
const pairedMs = 30_000;
const features = new URL('../features/', import.meta.url);
const withheld = 'A secret survived redaction, so this record was withheld.\n';

type Width = (typeof sweepWidths)[number];
type Theme = (typeof sweepThemes)[number];
type State = (typeof sweepStates)[number];
type Target = { entry: string; board?: string };
type Review = {
  reviewId?: string | undefined;
  revision?: number | undefined;
  layerId?: string | undefined;
};
type Shot = {
  target: number;
  entry: string;
  state: State;
  theme: Theme;
  width: Width;
  path?: string;
  file?: string;
  problems: string[];
  skipped?: string;
};
type Composite = { target: number; file: string };

function sweepTokens(args: readonly string[]) {
  try {
    return parseArgs({
      args: [...args],
      options: {
        instance: { type: 'string' },
        board: { type: 'string', multiple: true },
      },
      allowPositionals: true,
      strict: true,
      tokens: true,
    }).tokens;
  } catch (error) {
    throw new Usage(
      `sweep takes routes, --board <png> and --instance: ${firstLine(error)}`,
      { cause: error },
    );
  }
}

function sweepTargets(args: readonly string[]): Target[] {
  const tokens = sweepTokens(args);
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

const reviewValues = new Set(['reviewId', 'revision', 'layerId']);

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
    revision: review.revision?.toString(),
    layerId: review.layerId,
  };
  const route = mapRoute(entry);
  const missing = [...route.matchAll(/\$(\w*)/g)]
    .map((match) => match[1] ?? '')
    .filter((name) => values[name] === undefined);
  if (missing.some((name) => !reviewValues.has(name)))
    throw new Usage(
      `${entry} routes to ${route}; pass a concrete path for ${missing.map((name) => `$${name}`).join(', ')}.`,
    );
  if (missing.length > 0)
    return { skipped: 'no review is published in this state' };
  return route.replace(/\$(\w+)/g, (_, name: string) => values[name] ?? '');
}

async function sessionOf(instance: WebInstance, recorder: Recorder) {
  const handle = await ServerHandle.attach(instance.detail.manifest);
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
  return {
    reviewId: review?.reviewId,
    revision: review?.revision,
    layerId: review?.layers[0]?.id,
  };
}

async function pair(page: Page, instance: WebInstance, recorder: Recorder) {
  const grant = await issuedLink(
    instance.detail.manifest,
    'Sweep browser',
    false,
    recorder,
  );
  recorder.secret(grant.code);
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
  const describe = (element, right) => {
    const label = element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 60) ?? '';
    return '<' + element.tagName.toLowerCase() + '> "' + label + '" ends at ' + Math.round(right) + ' px';
  };
  const past = (element) => element.getBoundingClientRect().right > width + 1;
  const offenders = scrollWidth > width
    ? [...document.body.querySelectorAll('*')]
        .filter((element) => past(element) && (element.parentElement === null || !past(element.parentElement)))
        .slice(0, 5)
        .map((element) => describe(element, element.getBoundingClientRect().right))
    : [];
  const clipped = [];
  const truncated = (element) => {
    for (let box = element; box !== null; box = box.parentElement)
      if (getComputedStyle(box).textOverflow === 'ellipsis') return true;
    return false;
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null && clipped.length < 5; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (parent === null || node.textContent.trim() === '' || clipped.some((entry) => entry.element === parent)) continue;
    const box = parent.getBoundingClientRect();
    const style = getComputedStyle(parent);
    if (box.width <= 1 || box.height <= 1 || style.visibility === 'hidden' || style.whiteSpace === 'pre') continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const spill = [...range.getClientRects()].find((rect) => rect.width > 0 && rect.right > 0 && rect.left < width && rect.right > box.right + 8);
    if (spill !== undefined && !truncated(parent))
      clipped.push({ element: parent, text: describe(parent, spill.right) + ' past its box at ' + Math.round(box.right) + ' px' });
  }
  const row = (element) => {
    const style = getComputedStyle(element);
    return (style.display.endsWith('flex') && style.flexDirection.startsWith('row') && style.flexWrap === 'nowrap') || (style.display.endsWith('grid') && style.gridAutoFlow.startsWith('column'));
  };
  const oneRow = (element) => row(element) || (element.children.length === 1 && row(element.children[0]));
  const sideways = [...document.body.querySelectorAll('*')]
    .filter((element) => {
      const style = getComputedStyle(element);
      return (style.overflowY === 'auto' || style.overflowY === 'scroll') && style.visibility !== 'hidden' && element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 8 && !oneRow(element);
    })
    .slice(0, 5)
    .map((element) => describe(element, element.getBoundingClientRect().right).replace(/ ends at .*$/, '') + ' holds ' + element.scrollWidth + ' px of content in ' + element.clientWidth + ' px');
  return { width, scrollWidth, dark: root.classList.contains('dark'), offenders, clipped: clipped.map((entry) => entry.text), sideways };
})()`;
const layoutSchema = Schema.Struct({
  width: Schema.Number,
  scrollWidth: Schema.Number,
  dark: Schema.Boolean,
  offenders: Schema.Array(Schema.String),
  clipped: Schema.Array(Schema.String),
  sideways: Schema.Array(Schema.String),
});
const textScript = 'document.fonts.ready.then(() => document.body.innerText)';
const imagesLoadedScript =
  '[...document.images].every((image) => image.complete)';

async function settledText(page: Page): Promise<string | undefined> {
  const deadline = Date.now() + settledMs;
  let last: unknown;
  let unchanged = 0;
  while (Date.now() < deadline) {
    const now: unknown = await page.evaluate(textScript);
    unchanged = now === last ? unchanged + 1 : 0;
    last = now;
    if (unchanged >= stableReads && typeof now === 'string') return now;
    await sleep(readEveryMs);
  }
  return undefined;
}

function firstLine(error: unknown) {
  return error instanceof Error
    ? (error.message.split('\n')[0] ?? '')
    : String(error);
}

type Signed = Awaited<ReturnType<BrowserContext['storageState']>>;

async function shoot(
  signed: Signed,
  url: URL,
  shot: Shot,
  file: string,
): Promise<void> {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    storageState: signed,
    viewport: { width: shot.width, height: heights[shot.width] },
    colorScheme: shot.theme,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const record = (problem: string) => shot.problems.push(problem);
  const onPageError = (error: Error) =>
    record(`page error: ${firstLine(error)}`);
  const onConsole = (message: { type(): string; text(): string }) => {
    if (message.type() === 'error') record(`console error: ${message.text()}`);
  };
  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  try {
    const response = await page.goto(url.href, { waitUntil: 'load' });
    if (response !== null && !response.ok())
      record(`the page answered HTTP ${response.status()}`);
    await page
      .waitForLoadState('networkidle', { timeout: networkIdleMs })
      .catch(() => record('the network did not go idle within 20 s'));
    const text = await settledText(page);
    if (text === undefined) record('the content kept changing for 15 s');
    else if (text.trim() === '') record('the page rendered no text');
    const landed = new URL(page.url());
    if (`${landed.pathname}${landed.search}` !== `${url.pathname}${url.search}`)
      record(`landed on ${landed.pathname}${landed.search} instead`);
    const layout = Schema.decodeUnknownSync(layoutSchema)(
      await page.evaluate(layoutScript),
    );
    if (layout.scrollWidth > layout.width)
      record(
        `overflows horizontally: ${layout.scrollWidth} px of content in ${layout.width} px${layout.offenders.length > 0 ? ` (${layout.offenders.join('; ')})` : ''}`,
      );
    if (layout.clipped.length > 0)
      record(`text runs past its box: ${layout.clipped.join('; ')}`);
    if (layout.sideways.length > 0)
      record(
        `a scrolling area is wider than itself: ${layout.sideways.join('; ')}`,
      );
    if (layout.dark !== (shot.theme === 'dark'))
      record(`the ${shot.theme} theme did not apply`);
    await page.screenshot({ path: file, fullPage: true });
    shot.file = file;
  } finally {
    await browser.close();
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

function indexMarkdown(
  instance: WebInstance,
  folder: string,
  targets: readonly Target[],
  shots: readonly Shot[],
  composites: readonly Composite[],
  seeds: readonly unknown[],
  failure: string | undefined,
) {
  const link = (file: string) => relative(folder, file);
  const problems = [
    ...(failure === undefined ? [] : [`- The sweep stopped: ${failure}`]),
    ...shots.flatMap((shot) =>
      shot.problems.map(
        (problem) =>
          `- \`${shot.path ?? shot.entry}\` ${shot.state} ${shot.theme} ${shot.width}: ${problem}`,
      ),
    ),
  ];
  const cell = (shot: Shot | undefined) =>
    shot === undefined
      ? '—'
      : shot.skipped !== undefined
        ? `skipped: ${shot.skipped}`
        : shot.file === undefined
          ? 'not captured'
          : `[${shot.problems.length === 0 ? 'pass' : 'problem'}](${link(shot.file)})`;
  const sections = targets.map((target, index) => {
    const mine = shots.filter((shot) => shot.target === index);
    const rows = sweepStates.flatMap((state) =>
      sweepThemes.map(
        (theme) =>
          `| ${state} | ${theme} | ${sweepWidths
            .map((width) =>
              cell(
                mine.find(
                  (shot) =>
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
        mine.flatMap((shot) =>
          shot.path === undefined ? [] : [`\`${shot.path}\``],
        ),
      ),
    ];
    const boards = composites
      .filter((item) => item.target === index)
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

async function captureAll(
  instance: WebInstance,
  browser: Browser,
  recorder: Recorder,
  targets: readonly Target[],
  folder: string,
  found: { shots: Shot[]; composites: Composite[]; seeds: unknown[] },
) {
  const pairing = await browser.newContext();
  const signed = await pair(await pairing.newPage(), instance, recorder).then(
    () => pairing.storageState(),
  );
  await pairing.close();
  const session = await sessionOf(instance, recorder);
  for (const state of sweepStates) {
    if (state !== 'as-is')
      found.seeds.push(await seedStressSample(session, state));
    const review = await latestReview(session);
    for (const [index, target] of targets.entries()) {
      const path = resolved(instance, target.entry, review);
      const directory = join(folder, slug(target.entry, index), state);
      if (typeof path === 'string')
        await mkdir(directory, { recursive: true, mode: 0o700 });
      for (const theme of sweepThemes)
        for (const width of sweepWidths) {
          const shot: Shot = {
            target: index,
            entry: target.entry,
            state,
            theme,
            width,
            problems: [],
          };
          found.shots.push(shot);
          if (typeof path !== 'string') {
            shot.skipped = path.skipped;
            continue;
          }
          shot.path = path;
          await shoot(
            signed,
            new URL(path, instance.detail.web),
            shot,
            join(directory, `${theme}-${width}.png`),
          ).catch((error: unknown) => {
            shot.problems.push(`not captured: ${firstLine(error)}`);
          });
        }
      const boards = [
        ['light', target.board],
        ['dark', target.board && darkBoard(target.board)],
      ] as const;
      for (const [theme, board] of state === 'as-is' ? boards : []) {
        const shot = found.shots.find(
          (item) =>
            item.target === index &&
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
        found.composites.push({ target: index, file });
      }
    }
  }
}

export async function sweep(
  instance: WebInstance,
  args: readonly string[],
): Promise<string> {
  const targets = sweepTargets(args);
  for (const target of targets) resolved(instance, target.entry, {});
  const redactor = registry.redactor(instance);
  const recorder = redactor.recorder();
  const record = await registry.evidence(instance).claim('sweep', 'json');
  const folder = record.replace(/\.json$/, '');
  const found = {
    shots: [] as Shot[],
    composites: [] as Composite[],
    seeds: [] as unknown[],
  };
  let failure: string | undefined;
  const browser = await chromium.launch();
  try {
    await captureAll(instance, browser, recorder, targets, folder, found);
  } catch (error) {
    failure = firstLine(error);
  } finally {
    await browser.close();
  }
  const safe = (text: string) => {
    const clean = redactor.text(recorder.scrub(text));
    return recorder.leaks(clean) > 0 ? withheld : clean;
  };
  const index = join(folder, 'index.md');
  await mkdir(folder, { recursive: true, mode: 0o700 });
  await writeFile(
    index,
    safe(
      indexMarkdown(
        instance,
        folder,
        targets,
        found.shots,
        found.composites,
        found.seeds,
        failure,
      ),
    ),
    { mode: 0o600 },
  );
  await writeFile(
    record,
    safe(
      `${JSON.stringify(
        {
          command: args,
          index,
          failure,
          seeds: found.seeds,
          shots: found.shots.map((shot) => ({
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
  const problems =
    found.shots.reduce((sum, shot) => sum + shot.problems.length, 0) +
    (failure === undefined ? 0 : 1);
  const captured = found.shots.filter((shot) => shot.file !== undefined).length;
  if (problems > 0)
    throw new Refusal(
      `The sweep found ${problems} problem${problems === 1 ? '' : 's'} in ${captured} captures; read ${index}`,
    );
  return `swept ${captured} captures with no problems\nindex ${index}\n`;
}
