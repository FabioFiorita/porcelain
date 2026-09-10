import { createHighlighter } from '@tanstack/highlight/core';
import { css } from '@tanstack/highlight/languages/css';
import { diff } from '@tanstack/highlight/languages/diff';
import { json } from '@tanstack/highlight/languages/json';
import { ts } from '@tanstack/highlight/languages/ts';
import { tsx } from '@tanstack/highlight/languages/tsx';

const highlighter = createHighlighter({
  languages: [ts, tsx, css, json, diff],
});
export function highlightedLines(text: string, language: string) {
  // Tokenize the whole document so multiline comments and strings retain context.
  const tokens = highlighter.tokenize(text, { lang: language }).tokens;
  const lines: { value: string; className: string; offset: number }[][] = [[]];
  const position = { offset: 0 };
  for (const token of tokens) {
    const parts = token.value.split('\n');
    for (const [index, value] of parts.entries()) {
      if (index > 0) {
        lines.push([]);
        position.offset += 1;
      }
      lines.at(-1)?.push({
        value,
        className: token.className ?? '',
        offset: position.offset,
      });
      position.offset += value.length;
    }
  }
  return lines;
}
