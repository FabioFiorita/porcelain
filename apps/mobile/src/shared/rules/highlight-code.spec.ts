import { describe, expect, it } from 'vitest';
import { highlightCode } from './highlight-code.ts';
import { mergeDiffTokens } from './merge-diff-tokens.ts';

describe('mobile source highlighting', () => {
  it('bounds tokenizer batches and yields without altering literal source', async () => {
    const chunks: string[] = [];
    let yields = 0;
    const source = 'comment\n'.repeat(101) + '<script>&copy;</script>\n';
    const lines = await highlightCode(
      source,
      (chunk) => {
        chunks.push(chunk);
        return chunk
          .split('\n')
          .map((content) => [{ content, color: '#737373' }]);
      },
      undefined,
      async () => {
        yields++;
      },
    );
    expect(chunks).toEqual([
      'comment\n'.repeat(99) + 'comment',
      'comment\n<script>&copy;</script>\n',
    ]);
    expect(yields).toBe(1);
    expect(
      lines.map((line) => line.map((token) => token.text).join('')).join('\n'),
    ).toBe(source);
    expect(lines[100]).toEqual([{ text: 'comment', color: 0xff737373 }]);
    expect(lines[101]).toEqual([
      { text: '<script>&copy;</script>', color: 0xff737373 },
    ]);
    expect(lines[102]).toEqual([]);
  });
  it('converts syntax colors and styles and removes empty tokens', async () => {
    expect(
      await highlightCode('const ready', () => [
        [
          { content: 'const', color: '#d568ea', fontStyle: 3 },
          { content: '', color: '#000000' },
          { content: ' ready', fontStyle: 0 },
        ],
      ]),
    ).toEqual([
      [{ text: 'const', color: 0xffd568ea, fontStyle: 3 }, { text: ' ready' }],
    ]);
  });
  it('normalizes CRLF and preserves blank lines without a tokenizer', async () => {
    expect(await highlightCode('one\r\n\r\nthree', undefined)).toEqual([
      [{ text: 'one' }],
      [],
      [{ text: 'three' }],
    ]);
    expect(await highlightCode('', undefined)).toEqual([[]]);
  });
  it('discards cancelled work before the first batch and after yielding', async () => {
    const controller = new AbortController();
    let calls = 0;
    const tokenize = (chunk: string) => {
      calls++;
      return chunk.split('\n').map((content) => [{ content }]);
    };
    expect(
      await highlightCode(
        'line\n'.repeat(100),
        tokenize,
        controller.signal,
        async () => controller.abort(),
      ),
    ).toEqual([]);
    expect(calls).toBe(1);
    expect(await highlightCode('line', tokenize, controller.signal)).toEqual(
      [],
    );
    expect(calls).toBe(1);
  });
  it('combines syntax colors and word-change ranges without altering source', () => {
    expect(
      mergeDiffTokens(
        [
          { text: 'return ', color: 0xfffc2b73 },
          { text: 'false;', color: 0xff1ca1c7 },
        ],
        [{ text: 'return f' }, { text: 'als', changed: true }, { text: 'e;' }],
      ),
    ).toEqual([
      { text: 'return ', color: 0xfffc2b73 },
      { text: 'f', color: 0xff1ca1c7 },
      { text: 'als', color: 0xff1ca1c7, changed: true },
      { text: 'e;', color: 0xff1ca1c7 },
    ]);
    expect(
      mergeDiffTokens(
        [{ text: 'actual source', color: 0xfffc2b73 }],
        [{ text: 'mismatched annotation', changed: true }],
      ),
    ).toEqual([{ text: 'actual source', color: 0xfffc2b73 }]);
  });
});
