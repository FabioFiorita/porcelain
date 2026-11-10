import { test } from '@porcelain/server/kit/server-test';
import { list, record, text } from '@porcelain/server/kit/session';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { expect } from 'vitest';
import {
  cli,
  printed,
  repositoryRoot,
  started,
  WEB_CLI,
} from './verification-cli.ts';

const SWEEP_CASE_MS = 10 * 60_000;
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

test(
  'a sweep captures each route in every state, theme and width beside its board, fails on a page error, a console error or overflow without retrying them, and labels a rerun’s first state as-left',
  async ({ onTestFinished }) => {
    const publicFolder = join(repositoryRoot, 'apps/web/public');
    for (const [name, html] of Object.entries(pages))
      await writeFile(join(publicFolder, name), html);
    onTestFinished(async () => {
      for (const name of Object.keys(pages))
        await rm(join(publicFolder, name), { force: true });
    });
    const boards = await mkdtemp(join(tmpdir(), 'porcelain-sweep-board-'));
    onTestFinished(() => rm(boards, { recursive: true, force: true }));
    const board = join(boards, 'Fixture.png');
    await writeFile(board, onePixelPng);
    await writeFile(join(boards, 'Fixture-D.png'), onePixelPng);
    const instance = await started(onTestFinished, { path: WEB_CLI });
    const web = (...args: string[]) =>
      cli(repositoryRoot, WEB_CLI, ...args, '--instance', instance.id);

    const clean = await web('sweep', '/sweep-fixture.html', '--board', board);
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
    expect(
      list(printed(await web('server', 'devices')))
        .map(record)
        .filter((device) => /^Device [0-9]{2}$/.test(text(device.label))),
    ).toHaveLength(12);

    const failing = await web(
      'sweep',
      '/sweep-error.html',
      '/sweep-unavailable.html',
    );
    const failingIndex = /read (\S+)\n$/.exec(failing.stderr)?.[1] ?? '';
    const failed = await readFile(failingIndex, 'utf8');
    const failedRecord = record(
      JSON.parse(
        await readFile(failingIndex.replace(/\/index\.md$/, '.json'), 'utf8'),
      ),
    );
    const shots = list(failedRecord.shots).map(record);
    const errors = shots.filter((shot) => shot.entry === '/sweep-error.html');
    const unavailable = shots.filter(
      (shot) => shot.entry === '/sweep-unavailable.html',
    );

    expect(failing.code).toBe(1);
    expect(failing.stderr).toMatch(
      /^The sweep found \d+ problems in 36 captures\. First: `\/sweep-error\.html` as-left light 1440: page error: sweep fixture page error\nread \S+\/index\.md\n$/,
    );
    expect(failedRecord.states).toStrictEqual([
      'as-left',
      'long-text',
      'many-items',
    ]);
    expect(failed).toContain(
      'States in order: as-left, long-text, many-items. An earlier sweep already seeded this instance',
    );
    expect(
      await filesUnder(failingIndex.replace(/\/index\.md$/, '')),
    ).toStrictEqual(
      [
        'index.md',
        ...captures('01-sweep-error.html', 'as-left'),
        ...captures('02-sweep-unavailable.html', 'as-left'),
      ].toSorted(),
    );
    expect(failed).toContain(
      '- `/sweep-error.html` as-left light 1440: page error: sweep fixture page error\n',
    );
    expect(failed).toContain(
      '- `/sweep-error.html` as-left light 414: overflows horizontally: 2000 px of content in 414 px (<div> "Too wide" ends at 2000 px)\n',
    );
    expect(failed).toContain(
      '`/sweep-unavailable.html` as-left light 1440: unavailable page: Page not found',
    );
    expect(failed).toContain(
      '`/sweep-unavailable.html` as-left dark 1440: unavailable page: Computer unavailable',
    );
    expect(failed).not.toContain('`/sweep-fixture.html`');
    expect(failed).not.toContain('## Retries');
    expect(
      errors.map((shot) => [
        shot.state,
        shot.theme,
        shot.width,
        list(shot.problems),
        shot.retried,
      ]),
    ).toStrictEqual(
      ['as-left', 'long-text', 'many-items'].flatMap((state) => [
        [
          state,
          'light',
          1440,
          ['page error: sweep fixture page error'],
          undefined,
        ],
        [
          state,
          'light',
          1080,
          ['console error: sweep fixture console error'],
          undefined,
        ],
        [
          state,
          'light',
          414,
          [
            'overflows horizontally: 2000 px of content in 414 px (<div> "Too wide" ends at 2000 px)',
          ],
          undefined,
        ],
        [state, 'dark', 1440, [], undefined],
        [state, 'dark', 1080, [], undefined],
        [
          state,
          'dark',
          414,
          ['console error: Target crashed: the review socket has been closed'],
          undefined,
        ],
      ]),
    );
    expect(
      unavailable.map((shot) => [
        shot.state,
        shot.theme,
        shot.width,
        list(shot.problems),
        shot.retried,
      ]),
    ).toStrictEqual(
      ['as-left', 'long-text', 'many-items'].flatMap((state) => [
        [state, 'light', 1440, ['unavailable page: Page not found'], undefined],
        [state, 'light', 1080, ['unavailable page: Page not found'], undefined],
        [state, 'light', 414, ['unavailable page: Page not found'], undefined],
        [
          state,
          'dark',
          1440,
          ['unavailable page: Computer unavailable'],
          undefined,
        ],
        [
          state,
          'dark',
          1080,
          ['unavailable page: Computer unavailable'],
          undefined,
        ],
        [
          state,
          'dark',
          414,
          ['unavailable page: Computer unavailable'],
          undefined,
        ],
      ]),
    );
    expect(
      list(failedRecord.seeds)
        .map(record)
        .map((seed) => seed.applied),
    ).toStrictEqual([false, false]);
    expect(
      shots
        .filter((shot) => list(shot.problems).length > 0)
        .map((shot) => text(shot.entry))
        .filter((entry, at, all) => all.indexOf(entry) === at),
    ).toStrictEqual(['/sweep-error.html', '/sweep-unavailable.html']);
    expect(
      list(printed(await web('server', 'devices')))
        .map(record)
        .filter((device) => /^Device [0-9]{2}$/.test(text(device.label))),
    ).toHaveLength(12);
  },
  SWEEP_CASE_MS,
);
