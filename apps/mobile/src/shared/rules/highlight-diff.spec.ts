import { diffLines } from '@porcelain/client/changes/rules';
import { createOnigurumaEngine } from 'shiki/engine/oniguruma';
import { expect, it } from 'vitest';

import { createCodeHighlighter } from '../../components/ui/code-highlighter';
import { diffSources, highlightDiffLines } from './highlight-diff';
import type { RenderLine } from './render-model';

const signal = new AbortController().signal;

async function highlighter() {
  return createCodeHighlighter(
    await createOnigurumaEngine(import('shiki/wasm')),
  );
}

async function colouredDiff(patch: string, language: string) {
  const parsed = diffLines(patch);
  if (parsed.kind !== 'text') throw new Error('expected a text diff');
  const highlight = await highlighter();
  const { oldSource, newSource } = diffSources(parsed.lines);
  return highlightDiffLines(
    parsed.lines,
    await highlight(oldSource, language, 'light', signal),
    await highlight(newSource, language, 'light', signal),
  );
}

const row = (lines: readonly RenderLine[], text: string) => {
  const line = lines.find((candidate) => candidate.text === text);
  if (!line) throw new Error(`missing row: ${text}`);
  return line;
};

it('colours diff rows on both sides exactly as the file viewer colours that code', async () => {
  const lines = await colouredDiff(
    [
      '@@ -1,3 +1,3 @@',
      ' export function ready() {',
      '-  return false;',
      '+  return true;',
      ' }',
    ].join('\n'),
    'typescript',
  );
  const file = await (
    await highlighter()
  )(
    'export function ready() {\n  return true;\n}',
    'typescript',
    'light',
    signal,
  );
  expect(row(lines, '  return true;').tokens).toEqual(file[1]);
  expect(row(lines, 'export function ready() {').tokens).toEqual(file[0]);
  expect(
    row(lines, '  return false;').tokens?.map((token) => token.text),
  ).toEqual(['  ', 'return', ' ', 'false', ';']);
  expect(
    row(lines, '  return false;').tokens?.some(
      (token) => token.color !== undefined,
    ),
  ).toBe(true);
});

it('keeps hunk headers out of the grammar so the code after one still colours', async () => {
  const lines = await colouredDiff(
    [
      '@@ -1,1 +1,1 @@',
      '-.card { color: red; }',
      '+.card { color: blue; }',
      '@@ -9,1 +9,1 @@',
      '-.title { margin: 0; }',
      '+.title { margin: 1px; }',
    ].join('\n'),
    'css',
  );
  const file = await (
    await highlighter()
  )('.title { margin: 1px; }', 'css', 'light', signal);
  expect(row(lines, '.title { margin: 1px; }').tokens).toEqual(file[0]);
  expect(row(lines, '@@ -9,1 +9,1 @@').tokens).toBeUndefined();
});
