import { diffLines } from '@porcelain/client/changes/rules';
import { createOnigurumaEngine } from 'shiki/engine/oniguruma';
import { expect, it } from 'vitest';

import { createCodeHighlighter } from './code-highlighter';
import {
  diffSources,
  highlightDiffLines,
} from '../../../shared/rules/highlight-diff';
import type { RenderLine } from '../../../shared/rules/render-model';

const signal = new AbortController().signal;

it('gives the native view a turn before highlighting and drops a cancelled job', async () => {
  const scheduled = Promise.withResolvers<void>();
  const frame = Promise.withResolvers<void>();
  const highlight = await createCodeHighlighter(
    await createOnigurumaEngine(import('shiki/wasm')),
    () => {
      scheduled.resolve();
      return frame.promise;
    },
  );
  const controller = new AbortController();
  const result = highlight(
    'export const ready = true;',
    'typescript',
    'light',
    controller.signal,
  );
  expect(
    await Promise.race([
      scheduled.promise.then(() => 'scheduled'),
      result.then(() => 'finished'),
    ]),
  ).toBe('scheduled');
  controller.abort();
  frame.resolve();
  expect(await result).toEqual([]);
});

async function highlighter() {
  return createCodeHighlighter(
    await createOnigurumaEngine(import('shiki/wasm')),
    () => Promise.resolve(),
  );
}

it('keeps multiline grammar state across batches and isolated between files', async () => {
  const highlight = await highlighter();
  const source = [
    '/*',
    ...Array.from({ length: 45 }, () => 'export const commented = true;'),
    '*/',
    'export const ready = true;',
  ].join('\n');
  const [commented, ordinary] = await Promise.all([
    highlight(source, 'typescript', 'light', signal),
    highlight('export const ready = true;', 'typescript', 'light', signal),
  ]);
  expect(
    commented
      .map((line) => line.map((token) => token.text).join(''))
      .join('\n'),
  ).toBe(source);
  expect(commented[1]).toEqual(commented[40]);
  expect(commented[40]).toEqual([
    { text: 'export const commented = true;', color: 0xff737373 },
  ]);
  expect(commented.at(-1)).toEqual(ordinary[0]);
  expect(ordinary[0]?.map((token) => token.text)).toEqual([
    'export',
    ' ',
    'const',
    ' ',
    'ready',
    ' ',
    '=',
    ' ',
    'true',
    ';',
  ]);
});

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

it('colours excerpt rows that carry a line number and no kind', async () => {
  const excerpt: readonly RenderLine[] = [
    { id: 'a', text: 'export function ready() {', newLine: 4 },
    { id: 'b', text: '  return true;', newLine: 5 },
    { id: 'c', text: '}', newLine: 6 },
  ];
  const highlight = await highlighter();
  const { oldSource, newSource } = diffSources(excerpt);
  const lines = highlightDiffLines(
    excerpt,
    await highlight(oldSource, 'typescript', 'light', signal),
    await highlight(newSource, 'typescript', 'light', signal),
  );
  expect(newSource).toBe('export function ready() {\n  return true;\n}');
  expect(
    row(lines, '  return true;').tokens?.map((token) => token.text),
  ).toEqual(['  ', 'return', ' ', 'true', ';']);
});
