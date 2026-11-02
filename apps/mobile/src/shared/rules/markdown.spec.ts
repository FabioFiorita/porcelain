import { describe, expect, it } from 'vitest';
import { parseMarkdown } from './markdown.ts';

describe('native Markdown render data', () => {
  it('keeps escaped delimiters inside emphasis', () => {
    expect(parseMarkdown('*foo\\*bar*')[0]?.runs).toEqual([
      { text: 'foo', italic: true },
      { text: '*', italic: true },
      { text: 'bar', italic: true },
    ]);
  });
  it('preserves strong underscores nested inside italics', () => {
    expect(parseMarkdown('_a __b__ c_')[0]?.runs).toEqual([
      { text: 'a ', italic: true },
      { text: 'b', bold: true, italic: true },
      { text: ' c', italic: true },
    ]);
  });
  it('balances parentheses in link destinations', () => {
    expect(
      parseMarkdown('[w](https://en.wikipedia.org/wiki/Foo_(bar))')[0]?.runs,
    ).toEqual([{ text: 'w', url: 'https://en.wikipedia.org/wiki/Foo_(bar)' }]);
  });
  it.each(['**', '__'])('keeps large unclosed %s spans literal', (marker) => {
    const source = `${marker}word `.repeat(12_000);
    expect(parseMarkdown(source)[0]?.runs).toEqual([{ text: source }]);
  });
  it('keeps intraword underscores, globs and spaced operators literal', () => {
    expect(
      parseMarkdown(
        'snake_case_name read_review_now foo__bar__baz src/*.ts and *.tsx 2 * 3 * 4',
      ),
    ).toEqual([
      {
        id: 0,
        kind: 'paragraph',
        level: 0,
        runs: [
          {
            text: 'snake_case_name read_review_now foo__bar__baz src/*.ts and *.tsx 2 * 3 * 4',
          },
        ],
      },
    ]);
  });
  it('preserves standalone emphasis followed by filename punctuation', () => {
    expect(parseMarkdown('Edit __init__.py and **bold**.')).toEqual([
      {
        id: 0,
        kind: 'paragraph',
        level: 0,
        runs: [
          { text: 'Edit ' },
          { text: 'init', bold: true },
          { text: '.py and ' },
          { text: 'bold', bold: true },
          { text: '.' },
        ],
      },
    ]);
  });
  it('finds valid emphasis after an unmatched intraword underscore', () => {
    expect(parseMarkdown('snake_case and _italic_ **bold**')).toEqual([
      {
        id: 0,
        kind: 'paragraph',
        level: 0,
        runs: [
          { text: 'snake_case and ' },
          { text: 'italic', italic: true },
          { text: ' ' },
          { text: 'bold', bold: true },
        ],
      },
    ]);
  });
  it('keeps non-ASCII intraword underscores literal and standalone emphasis styled', () => {
    expect(parseMarkdown('café_x_ _café_')).toEqual([
      {
        id: 0,
        kind: 'paragraph',
        level: 0,
        runs: [{ text: 'café_x_ ' }, { text: 'café', italic: true }],
      },
    ]);
  });
  it('preserves strong emphasis nested inside italics', () => {
    expect(parseMarkdown('*a **b** c*')).toEqual([
      {
        id: 0,
        kind: 'paragraph',
        level: 0,
        runs: [
          { text: 'a ', italic: true },
          { text: 'b', bold: true, italic: true },
          { text: ' c', italic: true },
        ],
      },
    ]);
  });
  it('shares blocks, whitespace and fence boundaries across platforms', () => {
    expect(
      parseMarkdown(
        '# Title\r\n\r\none\r\ntwo\r\n\r\n- file\r\n> quote\r\n\r\n````ts\r\n```\r\nconst x = 1;\r\n````\r\n~~~\r\nunfinished',
      ),
    ).toEqual([
      { id: 0, kind: 'heading', level: 1, runs: [{ text: 'Title' }] },
      { id: 1, kind: 'paragraph', level: 0, runs: [{ text: 'one\ntwo' }] },
      { id: 2, kind: 'list', level: 0, runs: [{ text: '• file' }] },
      { id: 3, kind: 'quote', level: 0, runs: [{ text: 'quote' }] },
      { id: 4, kind: 'code', level: 0, runs: [{ text: '```\nconst x = 1;' }] },
      { id: 5, kind: 'code', level: 0, runs: [{ text: 'unfinished' }] },
    ]);
  });
  it('sends literal code and the same inline styles and safe links to both renderers', () => {
    expect(
      parseMarkdown(
        '**bold *nested*** and _italic_ `**literal**` [mail](mailto:dev@example.com) [unsafe](javascript:alert) \\*escaped\\*',
      ),
    ).toEqual([
      {
        id: 0,
        kind: 'paragraph',
        level: 0,
        runs: [
          { text: 'bold ', bold: true },
          { text: 'nested', italic: true, bold: true },
          { text: ' and ' },
          { text: 'italic', italic: true },
          { text: ' ' },
          { text: '**literal**', code: true },
          { text: ' ' },
          { text: 'mail', url: 'mailto:dev@example.com' },
          { text: ' unsafe ' },
          { text: '*' },
          { text: 'escaped' },
          { text: '*' },
        ],
      },
    ]);
  });
});

describe('pull request evidence', () => {
  it('renders disclosure labels and both image syntaxes without raw HTML', () => {
    expect(
      parseMarkdown(`### Evidence
<details>
<summary>Screenshots</summary>
<img alt="iPad landscape receipt" src="https://github.com/user-attachments/assets/ipad" onerror="alert(1)" />
![macOS bridge acknowledgement](https://github.com/user-attachments/assets/mac)
</details>`),
    ).toEqual([
      { id: 0, kind: 'heading', level: 3, runs: [{ text: 'Evidence' }] },
      { id: 1, kind: 'paragraph', level: 0, runs: [{ text: 'Screenshots' }] },
      {
        id: 2,
        kind: 'image',
        level: 0,
        runs: [{ text: 'iPad landscape receipt' }],
        url: 'https://github.com/user-attachments/assets/ipad',
      },
      {
        id: 3,
        kind: 'image',
        level: 0,
        runs: [{ text: 'macOS bridge acknowledgement' }],
        url: 'https://github.com/user-attachments/assets/mac',
      },
    ]);
  });
  it('renders images and sanitizes HTML inside lists, quotes and headings', () => {
    expect(
      parseMarkdown(
        '- ![List receipt](https://example.com/list.png)\n> <img src="https://example.com/quote.png" alt="Quoted receipt"> Caption\n### <details><summary>Evidence</summary></details>',
      ),
    ).toEqual([
      {
        id: 0,
        kind: 'image',
        level: 0,
        runs: [{ text: 'List receipt' }],
        url: 'https://example.com/list.png',
      },
      {
        id: 1,
        kind: 'image',
        level: 0,
        runs: [{ text: 'Quoted receipt' }],
        url: 'https://example.com/quote.png',
      },
      { id: 2, kind: 'quote', level: 0, runs: [{ text: ' Caption' }] },
      { id: 3, kind: 'heading', level: 3, runs: [{ text: 'Evidence' }] },
    ]);
  });
  it('keeps unsafe image destinations as compact alt text and discards unsupported tags', () => {
    expect(
      parseMarkdown(
        '<script>alert(1)</script><img src="javascript:alert(1)" alt="private receipt"><div>Readable</div>',
      ),
    ).toEqual([
      { id: 0, kind: 'image', level: 0, runs: [{ text: 'private receipt' }] },
      { id: 1, kind: 'paragraph', level: 0, runs: [{ text: 'Readable' }] },
    ]);
  });
  it('preserves HTML inside fenced and inline code while reading multiline image attributes', () => {
    expect(
      parseMarkdown(
        '```html\n<img src="unsafe">\n```\n\n`<details>`\n\n<img\n src="https://example.com/image?a=1&amp;b=2"\n alt="Receipt" />',
      ),
    ).toEqual([
      { id: 0, kind: 'code', level: 0, runs: [{ text: '<img src="unsafe">' }] },
      {
        id: 1,
        kind: 'paragraph',
        level: 0,
        runs: [{ text: '<details>', code: true }],
      },
      {
        id: 2,
        kind: 'image',
        level: 0,
        runs: [{ text: 'Receipt' }],
        url: 'https://example.com/image?a=1&b=2',
      },
    ]);
  });
});
