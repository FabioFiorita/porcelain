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
  'sweep-fixture.html': `<!doctype html><title>Sweep fixture</title>${themed}<p>Fits every width.</p>`,
  'sweep-error.html': `<!doctype html><title>Sweep error</title>${themed}<script>throw new Error('sweep fixture page error');</script>`,
  'sweep-crash-text.html': `<!doctype html><title>Sweep crash text</title>${themed}<p>Fits every width.</p><script>if (innerWidth === 414) console.error('Target crashed: the review socket has been closed');</script>`,
  'sweep-overflow.html': `<!doctype html><title>Sweep overflow</title><style>body{margin:0}</style>${themed}<div aria-label="Too wide" style="width:2000px">Wide</div>`,
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
    expect(list(printed(await web('server', 'comment-threads')))).toHaveLength(
      31,
    );

    const failing = await web(
      'sweep',
      '/sweep-error.html',
      '/sweep-crash-text.html',
      '/sweep-overflow.html',
    );
    const failingIndex = /read (\S+)\n$/.exec(failing.stderr)?.[1] ?? '';
    const failed = await readFile(failingIndex, 'utf8');
    const failedRecord = record(
      JSON.parse(
        await readFile(failingIndex.replace(/\/index\.md$/, '.json'), 'utf8'),
      ),
    );
    const shots = list(failedRecord.shots).map(record);
    const crashText = shots.filter(
      (shot) => shot.entry === '/sweep-crash-text.html',
    );

    expect(failing.code).toBe(1);
    expect(failing.stderr).toMatch(
      /^The sweep found \d+ problems in 54 captures\. First: `\/sweep-error\.html` as-left light 1440: page error: sweep fixture page error\nread \S+\/index\.md\n$/,
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
      (await filesUnder(failingIndex.replace(/\/index\.md$/, ''))).filter(
        (file) => file.startsWith('02-sweep-crash-text.html/'),
      ),
    ).toStrictEqual(captures('02-sweep-crash-text.html', 'as-left').toSorted());
    expect(failed).toContain(
      '- `/sweep-error.html` as-left light 1440: page error: sweep fixture page error\n',
    );
    expect(failed).toContain(
      '- `/sweep-overflow.html` as-left light 414: overflows horizontally: 2000 px of content in 414 px (<div> "Too wide" ends at 2000 px)\n',
    );
    expect(failed).not.toContain('`/sweep-fixture.html`');
    expect(failed).not.toContain('## Retries');
    expect(
      crashText.map((shot) => [shot.width, list(shot.problems), shot.retried]),
    ).toStrictEqual(
      Array.from({ length: 6 }, () => [1440, 1080, 414]).flatMap((widths) =>
        widths.map((width) => [
          width,
          width === 414
            ? [
                'console error: Target crashed: the review socket has been closed',
              ]
            : [],
          undefined,
        ]),
      ),
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
    ).toStrictEqual([
      '/sweep-error.html',
      '/sweep-crash-text.html',
      '/sweep-overflow.html',
    ]);
    expect(list(printed(await web('server', 'comment-threads')))).toHaveLength(
      31,
    );
  },
  SWEEP_CASE_MS,
);
