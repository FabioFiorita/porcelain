import { describe, expect, it } from 'vitest';
import { highlightedLines } from './code-highlight';

describe('read-only code tokenization', () => {
  it('preserves incomplete code, multiline comments and untrusted markup as text', () => {
    const text =
      '/* a comment\ncontinued */\nconst view = <script>alert("x")</script>\nconst unfinished = "';
    const lines = highlightedLines(text, 'tsx');
    expect(
      lines.map((line) => line.map((token) => token.value).join('')).join('\n'),
    ).toBe(text);
    expect(lines[1]?.some((token) => token.className === 'comment')).toBe(true);
  });
  it('preserves unknown languages and large documents without dropping lines', () => {
    const text = Array.from(
      { length: 10000 },
      (_, i) => `line ${i} <img onerror=alert(1)>`,
    ).join('\n');
    const lines = highlightedLines(text, 'unsupported');
    expect(lines).toHaveLength(10000);
    expect(
      lines
        .at(-1)
        ?.map((token) => token.value)
        .join(''),
    ).toBe('line 9999 <img onerror=alert(1)>');
  });
});
