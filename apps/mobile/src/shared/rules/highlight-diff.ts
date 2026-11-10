import { mergeDiffTokens } from './merge-diff-tokens.ts';
import type { RenderLine, RenderToken } from './render-model.ts';

type SideTokens = readonly (readonly RenderToken[])[] | undefined;

const isCode = (line: RenderLine) => line.kind && line.kind !== 'gap';
const oldSide = (lines: readonly RenderLine[]) =>
  lines.filter((line) => line.kind !== 'added');
const newSide = (lines: readonly RenderLine[]) =>
  lines.filter((line) => line.kind !== 'removed');
const sideSource = (lines: readonly RenderLine[]) =>
  lines.map((line) => (isCode(line) ? line.text : '')).join('\n');

export function diffSources(lines: readonly RenderLine[]) {
  return {
    oldSource: sideSource(oldSide(lines)),
    newSource: sideSource(newSide(lines)),
  };
}

export function highlightDiffLines(
  lines: readonly RenderLine[],
  oldTokens: SideTokens,
  newTokens: SideTokens,
): readonly RenderLine[] {
  const highlighted = new Map([
    ...oldSide(lines).map(
      (line, index) => [line.id, oldTokens?.[index]] as const,
    ),
    ...newSide(lines).map(
      (line, index) => [line.id, newTokens?.[index]] as const,
    ),
  ]);
  return lines.map((line) => {
    const tokens = isCode(line) ? highlighted.get(line.id) : undefined;
    return tokens
      ? { ...line, tokens: mergeDiffTokens(tokens, line.tokens) }
      : line;
  });
}
