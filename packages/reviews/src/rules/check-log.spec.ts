import { expect, it } from 'vite-plus/test';
import { checkLogExcerpt } from './check-log.ts';

const ESC = String.fromCharCode(27);
const stamp = (second: number, fraction = 0) =>
  `2026-11-25T10:00:${String(second).padStart(2, '0')}.${String(fraction).padStart(7, '0')}Z`;

it('keeps only the failing step, strips colour and reads GitHub markers', () => {
  const log = [
    `${stamp(1)} ##[group]Run pnpm install`,
    `${stamp(2)} Done in 2s`,
    `${stamp(3)} ##[endgroup]`,
    `${stamp(4, 5)} ##[group]Run pnpm test`,
    `${stamp(5)} ${ESC}[31m× shows the count${ESC}[39m`,
    'a continuation line without a timestamp',
    `${stamp(6)} ##[warning]Slow test`,
    `${stamp(7)} ##[error]Process completed with exit code 1.`,
    `${stamp(8)} ##[group]Run Upload traces`,
    `${stamp(9)} uploaded`,
    '',
  ].join('\n');
  expect(
    checkLogExcerpt(log, {
      from: '2026-11-25T10:00:04Z',
      to: '2026-11-25T10:00:08Z',
    }),
  ).toEqual({
    source: 'step',
    omitted: 0,
    lines: [
      { text: 'Run pnpm test', level: 'group' },
      { text: '× shows the count', level: 'plain' },
      { text: 'a continuation line without a timestamp', level: 'plain' },
      { text: 'Slow test', level: 'warning' },
      { text: 'Process completed with exit code 1.', level: 'error' },
    ],
  });
});

it('falls back to the end of the job log when the step window matches nothing', () => {
  const log = [`${stamp(1)} first`, `${stamp(2)} last`].join('\n');
  expect(
    checkLogExcerpt(log, {
      from: '2026-11-25T11:00:00Z',
      to: '2026-11-25T11:00:05Z',
    }),
  ).toEqual({
    source: 'job',
    omitted: 0,
    lines: [
      { text: 'first', level: 'plain' },
      { text: 'last', level: 'plain' },
    ],
  });
  expect(checkLogExcerpt(log).source).toBe('job');
});

it('ends just after the last error and keeps at most the line limit before it', () => {
  const lines = Array.from({ length: 1000 }, (_, index) =>
    index === 600 ? `${stamp(1)} ##[error]boom` : `${stamp(1)} line ${index}`,
  );
  const excerpt = checkLogExcerpt(lines.join('\n'));
  expect(excerpt.lines).toHaveLength(200);
  expect(excerpt.lines.at(-4)).toEqual({ text: 'boom', level: 'error' });
  expect(excerpt.lines.at(-1)?.text).toBe('line 603');
  expect(excerpt.lines[0]?.text).toBe('line 404');
  expect(excerpt.omitted).toBe(404);
});

it('caps the excerpt by UTF-8 bytes and clips very long lines', () => {
  const wide = 'é'.repeat(1500);
  const log = Array.from({ length: 100 }, () => `${stamp(1)} ${wide}`).join(
    '\n',
  );
  const excerpt = checkLogExcerpt(log, {}, { lines: 200, bytes: 10_000 });
  expect(excerpt.lines).toHaveLength(3);
  expect(excerpt.omitted).toBe(97);
  const long = checkLogExcerpt(`${stamp(1)} ${'x'.repeat(5000)}`);
  expect(long.lines[0]?.text).toBe(`${'x'.repeat(2000)}…`);
});
