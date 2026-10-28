import { expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { boardDiffOptions } from './board-diff.ts';
import { stylesMatch, styleTable } from './board-styles.ts';

it.each([
  ['fontSize', '13px', '13.5px', true],
  ['fontSize', '13px', '14px', false],
  ['lineHeight', '16px', '17px', false],
  ['fontWeight', '500', '400', false],
  ['letterSpacing', '-0.28px', '-0.3px', true],
  ['padding', '4px 8px 4px 6px', '4px 8px 4px 8px', false],
  ['radius', '7px 7px 7px 7px', '7px 7px 7px 7px', true],
  ['gap', '0px 6px', '0px 8px', false],
  ['height', '28px', '32px', false],
  ['colour', '#62626b', '#63626b', true],
  ['colour', '#62626b', '#62626b80', false],
  ['colour', '#62626b', '#62626c', true],
  ['colour', '#62626b', '#62626d', false],
  ['icon', 'present', 'absent', false],
])('%s compares %s with %s', (property, board, app, match) => {
  expect(stylesMatch(String(property), String(board), String(app))).toBe(match);
});

it.each([
  ['--width', '0', '--width takes'],
  ['--width', '1440,', '--width takes'],
  ['--width', '414.5', '--width takes'],
  ['--theme', 'sepia', '--theme takes'],
  ['--route', '//other.example/path', '--route must'],
  ['--route', '/\\other.example/path', '--route must'],
  ['--board', 'unknown', 'Unknown board'],
  ['--board', 'constructor', 'Unknown board'],
  ['--board', '__proto__', 'Unknown board'],
])('refuses invalid %s %s', (flag, value, message) => {
  expect(() =>
    boardDiffOptions([
      'board-diff',
      '--board',
      'sidebar',
      '--route',
      '/project/worktree',
      flag,
      value,
    ]),
  ).toThrow(message);
});

it('escapes role and value cells in the pasteable table', () => {
  expect(
    styleTable([
      {
        role: 'title | subtitle',
        property: 'element',
        board: '<missing>',
        app: 'line\nbreak',
        match: false,
      },
    ]),
  ).toContain(
    '| title \\| subtitle | element | &lt;missing&gt; | line break | NO |',
  );
});

it('accepts defaults, deduplicates widths and finds a board by its HTML name', () => {
  const directory = mkdtempSync(join(tmpdir(), 'board-diff-options-'));
  try {
    writeFileSync(join(directory, 'Narrative-desktop.html'), '<h1>Board</h1>');
    const args = [
      'board-diff',
      '--board',
      'Narrative-desktop',
      '--route',
      '/project/worktree',
      '--board-directory',
      directory,
    ];
    const defaults = boardDiffOptions(args);
    expect(defaults.widths).toStrictEqual([1440, 414]);
    expect(defaults.themes).toStrictEqual(['light', 'dark']);
    expect(defaults.board.html).toBe('Narrative-desktop.html');
    expect(
      boardDiffOptions([...args, '--width', '414,414', '--theme', 'dark'])
        .widths,
    ).toStrictEqual([414]);
    expect(() =>
      boardDiffOptions([
        ...args,
        '--board-directory',
        join(directory, 'missing'),
      ]),
    ).toThrow('Board HTML is missing');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
