import {
  IsolatedServer,
  Recorder,
} from '@porcelain/server/kit/isolated-server';
import { seedStressSample } from '@porcelain/server/kit/stress-sample';
import { openNodeHttpServer } from '@porcelain/server/kit/http';
import {
  captureSweepPage,
  sweepStates,
} from '../../web-verify/scripts/sweep.ts';
import { test } from '@porcelain/server/kit/server-test';
import { list, record, text } from '@porcelain/server/kit/session';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { expect, inject } from 'vitest';
import { cli, repositoryRoot, started, WEB_CLI } from './verification-cli.ts';

const themed = `<script>const media = matchMedia('(prefers-color-scheme: dark)'); const apply = () => document.documentElement.classList.toggle('dark', media.matches); apply(); media.addEventListener('change', apply);</script>`;
const pages = {
  'sweep-fixture.html': `<!doctype html><title>Sweep fixture</title>${themed}<h1>Page not found</h1><p>Fits every width.</p><pre>Computer unavailable</pre><span data-slot="breadcrumb-page" aria-current="page">Computer unavailable</span>`,
  'sweep-error.html': `<!doctype html><title>Sweep errors</title><style>body{margin:0}</style>${themed}<body><p>Fits every width.</p><script>
if (!media.matches) {
  if (innerWidth === 1440) throw new Error('sweep fixture page error');
  if (innerWidth === 1080) console.error('sweep fixture console error');
  if (innerWidth === 414) {
    const wide = document.createElement('div');
    wide.setAttribute('aria-label', 'Too wide');
    wide.style.width = '2000px';
    wide.textContent = 'Wide';
    document.body.append(wide);
  }
} else if (innerWidth === 414) console.error('Target crashed: the review socket has been closed');
</script>`,
  'sweep-unavailable.html': `<!doctype html><title>Unavailable</title>${themed}<style>@media(prefers-color-scheme:dark){[data-slot="state-notice"]{display:none}}@media(prefers-color-scheme:light){[data-unavailable-page]{display:none}}</style><section data-slot="state-notice"><h2>Page not found</h2></section><div role="alert" data-unavailable-page="Computer unavailable">This computer is no longer saved on this app.</div>`,
};
const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const captures = (folder: string, first = 'as-is') =>
  [first, 'long-text', 'many-items'].flatMap((state) =>
    ['light', 'dark'].flatMap((theme) =>
      [1440, 1080, 414].map(
        (width) => `${folder}/${state}/${theme}-${width}.png`,
      ),
    ),
  );

async function filesUnder(folder: string) {
  const entries = await readdir(folder, {
    recursive: true,
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(folder, join(entry.parentPath, entry.name)))
    .toSorted();
}

test('a sweep records its complete state, theme and width matrix beside its boards', async ({
  onTestFinished,
}) => {
  const boards = await mkdtemp(join(tmpdir(), 'porcelain-sweep-board-'));
  onTestFinished(() => rm(boards, { recursive: true, force: true }));
  const board = join(boards, 'Fixture.png');
  await writeFile(board, onePixelPng);
  await writeFile(join(boards, 'Fixture-D.png'), onePixelPng);
  const instance = await started(onTestFinished, { path: WEB_CLI });
  const runSweep = (...args: string[]) =>
    cli(
      repositoryRoot,
      process.execPath,
      join(repositoryRoot, '.agents/skills/spec/integration/sweep-driver.ts'),
      'sweep',
      ...args,
      '--instance',
      instance.id,
    );
  const clean = await runSweep('/sweep-fixture.html', '--board', board);
  const index = /\nindex (\S+)\n/.exec(`\n${clean.stdout}`)?.[1] ?? '';
  const folder = index.replace(/\/index\.md$/, '');

  expect(clean.code, clean.stderr).toBe(0);
  expect(clean.stdout).toBe(
    `swept 18 captures with no problems\nindex ${index}\n`,
  );
  expect(relative(instance.evidence, folder)).toMatch(/^\d{3}-sweep$/);
  expect(await filesUnder(folder)).toStrictEqual(
    [
      'index.md',
      '01-sweep-fixture.html/as-is/board-light-1440.png',
      '01-sweep-fixture.html/as-is/board-dark-1440.png',
      ...captures('01-sweep-fixture.html'),
    ].toSorted(),
  );
  const cleanIndex = await readFile(index, 'utf8');
  expect(cleanIndex).toContain('## Problems\n\nNone.\n');
  expect(cleanIndex).not.toContain('## Retries');
  expect(cleanIndex).toContain(
    '| as-is | dark | [pass](01-sweep-fixture.html/as-is/dark-1440.png) | [pass](01-sweep-fixture.html/as-is/dark-1080.png) | [pass](01-sweep-fixture.html/as-is/dark-414.png) |',
  );
  const seeds = list(
    record(JSON.parse(await readFile(`${folder}.json`, 'utf8'))).seeds,
  ).map(record);
  expect(seeds.map((seed) => [seed.variant, seed.applied])).toStrictEqual([
    ['long-text', true],
    ['many-items', true],
  ]);
});

test('stress seeds persist and a later sweep starts as-left without applying them again', async ({
  onTestFinished,
}) => {
  const server = await IsolatedServer.start(
    repositoryRoot,
    inject('serverBuild'),
  );
  onTestFinished(() => server.stop());
  const session = server.session(new Recorder(), await server.sampleIds());
  expect(sweepStates(session)).toEqual(['as-is', 'long-text', 'many-items']);
  for (const variant of ['long-text', 'many-items'] as const)
    expect(await seedStressSample(session, variant)).toEqual({
      variant,
      applied: true,
    });
  const before = await session.git('rev-parse', 'HEAD');
  const later = server.session(new Recorder(), await server.sampleIds());
  expect(sweepStates(later)).toEqual(['as-left', 'long-text', 'many-items']);
  for (const variant of ['long-text', 'many-items'] as const)
    expect(await seedStressSample(later, variant)).toEqual({
      variant,
      applied: false,
    });
  expect(await later.git('rev-parse', 'HEAD')).toBe(before);
  const devices = await later.send({
    method: 'GET',
    path: '/access',
    target: 'owner',
  });
  expect(devices.status).toBe(200);
  expect(
    list(record(devices.body).devices)
      .map(record)
      .filter((device) => /^Device [0-9]{2}$/.test(text(device.label))),
  ).toHaveLength(12);
});

test.for([
  { entry: 'sweep-fixture.html', width: 1440, theme: 'light', problems: [] },
  {
    entry: 'sweep-error.html',
    width: 1440,
    theme: 'light',
    problems: ['page error: sweep fixture page error'],
  },
  {
    entry: 'sweep-error.html',
    width: 1080,
    theme: 'light',
    problems: ['console error: sweep fixture console error'],
  },
  {
    entry: 'sweep-error.html',
    width: 414,
    theme: 'light',
    problems: [
      'overflows horizontally: 2000 px of content in 414 px (<div> "Too wide" ends at 2000 px)',
    ],
  },
  {
    entry: 'sweep-error.html',
    width: 414,
    theme: 'dark',
    problems: [
      'console error: Target crashed: the review socket has been closed',
    ],
  },
  {
    entry: 'sweep-unavailable.html',
    width: 1440,
    theme: 'light',
    problems: ['unavailable page: Page not found'],
  },
  {
    entry: 'sweep-unavailable.html',
    width: 1440,
    theme: 'dark',
    problems: ['unavailable page: Computer unavailable'],
  },
] as const)(
  'a real sweep capture diagnoses $entry at $width in $theme',
  async ({ entry, width, theme, problems }, { onTestFinished }) => {
    const host = await openNodeHttpServer((_request, response) => {
      response.setHeader('content-type', 'text/html');
      response.end(pages[entry]);
    });
    onTestFinished(() => host.close());
    const address = host.server.address();
    if (!address || typeof address === 'string')
      throw new Error('The capture fixture has no TCP address');
    const directory = await mkdtemp(join(tmpdir(), 'porcelain-capture-'));
    onTestFinished(() => rm(directory, { recursive: true, force: true }));
    const file = join(directory, 'capture.png');
    const shot = {
      target: 0,
      entry,
      state: 'as-is' as const,
      theme,
      width,
      problems: [] as string[],
    };
    await captureSweepPage(
      { cookies: [], origins: [] },
      new URL(`http://127.0.0.1:${address.port}/${entry}`),
      shot,
      file,
    );
    expect(shot.problems).toEqual(problems);
    expect((await readFile(file)).subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
  },
);
