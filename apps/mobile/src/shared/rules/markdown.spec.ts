import { describe, expect, it } from 'vitest';
import { parseMarkdown } from './markdown';

describe('native Markdown render data', () => {
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
          { text: ' ' },
          { text: 'unsafe' },
          { text: ' ' },
          { text: '*' },
          { text: 'escaped' },
          { text: '*' },
        ],
      },
    ]);
  });
});
