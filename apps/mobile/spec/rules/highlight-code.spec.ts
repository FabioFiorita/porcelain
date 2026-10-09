import { describe, expect, it } from 'vitest';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import { createCodeHighlighter } from '../../src/components/ui/code-highlighter.js';
import { mergeDiffTokens } from '../../src/shared/rules/merge-diff-tokens.js';

describe('mobile source highlighting', () => {
  it('preserves literal source, blank lines and multiline comments across chunks', async () => {
    const highlight = await createCodeHighlighter(
      createJavaScriptRegexEngine(),
    );
    const source =
      '/* first\n' +
      'comment\n'.repeat(100) +
      'second */\n\nconst html = "<script>&copy;</script>";\n';
    const lines = await highlight(source, 'typescript', 'light');
    expect(
      lines.map((line) => line.map((token) => token.text).join('')).join('\n'),
    ).toBe(source);
    expect(lines[100]).toEqual([{ text: 'comment', color: 0xff737373 }]);
    expect(lines[101]).toEqual([{ text: 'second */', color: 0xff737373 }]);
    expect(lines[102]).toEqual([]);
    expect(lines[103]).toContainEqual({ text: 'const', color: 0xffa631be });
    expect(lines[104]).toEqual([]);
  });
  it('uses the Pierre dark theme and native language grammars', async () => {
    const highlight = await createCodeHighlighter(
      createJavaScriptRegexEngine(),
    );
    const dark = await highlight('const ready = true;', 'ts', 'dark');
    expect(dark[0]).toContainEqual({ text: 'const', color: 0xffd568ea });
    const swift = await highlight('let ready = true', 'swift', 'light');
    expect(swift[0]).toContainEqual({ text: 'let', color: 0xffd32a61 });
    const kotlin = await highlight('val ready = true', 'kotlin', 'light');
    expect(kotlin[0]).toContainEqual({ text: 'val', color: 0xffd32a61 });
  });
  it('normalizes CRLF and keeps unknown languages readable', async () => {
    const highlight = await createCodeHighlighter(
      createJavaScriptRegexEngine(),
    );
    expect(
      await highlight('one\r\n\r\nthree', 'unknown-language', 'light'),
    ).toEqual([[{ text: 'one' }], [], [{ text: 'three' }]]);
    expect(await highlight('', undefined, 'light')).toEqual([[]]);
    const controller = new AbortController();
    controller.abort();
    expect(
      await highlight('const ready = true;', 'ts', 'light', controller.signal),
    ).toEqual([]);
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
