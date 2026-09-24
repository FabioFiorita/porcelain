import { describe, expect, it } from 'vitest';
import { summaryStyleWarnings } from './summary-style.ts';

function page(head: string, body = '<h1>Summary</h1>') {
  return `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
}

describe('summaryStyleWarnings', () => {
  it('has nothing to say about a page with a style element', () => {
    expect(summaryStyleWarnings(page('<style>body{margin:0}</style>'))).toEqual(
      [],
    );
  });

  it('accepts inline style attributes, quoted or not', () => {
    expect(
      summaryStyleWarnings(page('', '<h1 style="color:red">Summary</h1>')),
    ).toEqual([]);
    expect(
      summaryStyleWarnings(page('', "<h1 style='color:red'>Summary</h1>")),
    ).toEqual([]);
    expect(
      summaryStyleWarnings(page('', '<h1 style=color:red>Summary</h1>')),
    ).toEqual([]);
  });

  it('accepts a linked stylesheet but not another kind of link', () => {
    expect(
      summaryStyleWarnings(
        page('<link rel="stylesheet" href="https://cdn.example/app.css">'),
      ),
    ).toEqual([]);
    expect(
      summaryStyleWarnings(page('<link rel=stylesheet href=app.css>')),
    ).toEqual([]);
    expect(
      summaryStyleWarnings(page('<link rel="icon" href="favicon.ico">')),
    ).toHaveLength(1);
  });

  it('warns once when the page has no authored CSS', () => {
    const warnings = summaryStyleWarnings(page(''));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/^No authored CSS was detected/);
  });

  it.each([
    { name: 'an empty style element', markup: page('<style></style>') },
    { name: 'a blank style element', markup: page('<style>   </style>') },
    {
      name: 'a style element holding only a comment',
      markup: page('<style>/* later */</style>'),
    },
    {
      name: 'an empty style attribute',
      markup: page('', '<h1 style="">Summary</h1>'),
    },
    {
      name: 'a style attribute that starts with a space',
      markup: page('', '<h1 style=" color:red">Summary</h1>'),
    },
  ])('does not count $name as authored CSS', ({ markup }) => {
    expect(summaryStyleWarnings(markup)).toHaveLength(1);
  });

  it('ignores styles hidden in comments or written by scripts', () => {
    expect(
      summaryStyleWarnings(page('<!-- <style>body{margin:0}</style> -->')),
    ).toHaveLength(1);
    expect(
      summaryStyleWarnings(
        page(
          '<script>document.head.innerHTML = "<style>body{margin:0}</style>"</script>',
        ),
      ),
    ).toHaveLength(1);
  });
});
