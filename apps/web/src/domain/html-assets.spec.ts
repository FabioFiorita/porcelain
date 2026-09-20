import { expect, it } from 'vitest';
import { inlineHtmlAssets, type ReadAssets } from './html-assets';

/** A reader over a fixed set of files, recording each batch it was asked for. */
function reader(files: Record<string, [string, string]>) {
  const batches: string[][] = [];
  const read: ReadAssets = async (paths) => {
    batches.push(paths);
    return new Map(
      paths.map((path) => {
        const file = files[path];
        return [
          path,
          file ? { path, mediaType: file[0], base64: btoa(file[1]) } : null,
        ];
      }),
    );
  };
  return { read, batches };
}

it('resolves nested stylesheets and their local images relative to each asset', async () => {
  const { read, batches } = reader({
    'site/css/main.css': [
      'text/css',
      '@import "./theme.css"; body { background: url("../photo.png") }',
    ],
    'site/css/theme.css': ['text/css', 'body { color: rgb(10, 20, 30) }'],
    'site/photo.png': ['image/png', 'image bytes'],
  });
  const result = await inlineHtmlAssets(
    '<link rel="stylesheet" href="css/main.css"><img src="photo.png">',
    'site/index.html',
    read,
  );
  expect(result.missing).toEqual([]);
  // The document's own references first, then what its stylesheet named:
  // two requests where there used to be one per asset.
  expect(batches).toEqual([
    ['site/css/main.css', 'site/photo.png'],
    ['site/css/theme.css'],
  ]);
  expect(result.html).toContain('data:text/css');
  expect(result.html).toContain('data:image/png;base64,');
  expect(result.html).toContain("connect-src 'none'");
});

/**
 * The hole this step closes. The browser resolves `../` before anyone else
 * sees it, so `../secrets.js` from a document in `reports/` used to arrive at
 * the server as the ordinary-looking `secrets.js` and be read.
 */
it('refuses a reference that climbs out of the document folder', async () => {
  const { read, batches } = reader({ 'secrets.js': ['text/javascript', 'x'] });
  const result = await inlineHtmlAssets(
    '<script src="../secrets.js"></script><link rel="stylesheet" href="../../etc/theme.css">',
    'reports/index.html',
    read,
  );
  expect(batches).toEqual([]);
  expect(result.missing).toEqual(['../secrets.js', '../../etc/theme.css']);
  expect(result.html).not.toContain('secrets');
});

it('refuses an escape a stylesheet makes on the document’s behalf', async () => {
  const { read } = reader({
    'reports/main.css': [
      'text/css',
      'body { background: url("../secret.png") }',
    ],
    'secret.png': ['image/png', 'bytes'],
  });
  const result = await inlineHtmlAssets(
    '<link rel="stylesheet" href="main.css">',
    'reports/index.html',
    read,
  );
  expect(result.missing).toEqual(['../secret.png']);
});

it('reports missing and external assets and terminates cyclic CSS imports', async () => {
  const { read } = reader({
    'a.css': ['text/css', '@import "a.css";'],
  });
  const result = await inlineHtmlAssets(
    '<base href="https://other.invalid"><link rel="stylesheet" href="a.css"><img src="https://external.invalid/a.png"><img src="missing.png">',
    'index.html',
    read,
  );
  // The external reference is refused while the document is being read; the
  // cycle and the absent file are only discovered when they are rewritten.
  expect(result.missing).toEqual([
    'https://external.invalid/a.png',
    'a.css',
    'missing.png',
  ]);
  expect(result.html).not.toContain('<base');
});

it('keeps responsive image candidates and SVG fragment targets', async () => {
  const svg: [string, string] = ['image/svg+xml', '<svg/>'];
  const { read } = reader({
    'small.svg': svg,
    'large.svg': svg,
    'fallback.svg': svg,
    'filters.svg': svg,
  });
  const result = await inlineHtmlAssets(
    '<picture><source srcset="small.svg#small 1x, large.svg#large 2x"><img srcset="fallback.svg 320w"></picture><style>div { filter: url("filters.svg#shadow") }</style>',
    'index.html',
    read,
  );
  expect(result.missing).toEqual([]);
  expect(result.html).toContain(
    'data:image/svg+xml;base64,PHN2Zy8+#small 1x, data:image/svg+xml;base64,PHN2Zy8+#large 2x',
  );
  expect(result.html).toContain('data:image/svg+xml;base64,PHN2Zy8+ 320w');
  expect(result.html).toContain('data:image/svg+xml;base64,PHN2Zy8+#shadow');
});

/**
 * The read budget and the size of the document are different budgets. Forty
 * references to one small file are one read and forty copies, and only the
 * second of those is what the expanded cap promises to hold.
 */
it('counts every occurrence of a repeated asset against the expanded cap', async () => {
  const { read, batches } = reader({ 'big.png': ['image/png', 'x'] });
  const megabyte: ReadAssets = async (paths) => {
    const answered = await read(paths);
    return new Map(
      [...answered].map(([path, asset]) => [
        path,
        asset ? { ...asset, base64: 'A'.repeat(1024 * 1024) } : null,
      ]),
    );
  };
  const result = await inlineHtmlAssets(
    '<img src="big.png">'.repeat(40),
    'index.html',
    megabyte,
  );
  // Read once, well inside the read budget, but forty megabytes of document.
  expect(batches).toEqual([['big.png']]);
  expect(result.missing).toEqual(['big.png']);
  expect(result.html.length).toBeLessThan(28 * 1024 * 1024);
});

it('reads a repeatedly referenced asset once and bounds the expanded output', async () => {
  const { read, batches } = reader({
    'large.png': ['image/png', 'x'],
  });
  const oversized: ReadAssets = async (paths) => {
    const answered = await read(paths);
    return new Map(
      [...answered].map(([path, asset]) => [
        path,
        asset ? { ...asset, base64: 'A'.repeat(29 * 1024 * 1024) } : null,
      ]),
    );
  };
  const result = await inlineHtmlAssets(
    '<img src="large.png">'.repeat(40),
    'index.html',
    oversized,
  );
  expect(batches).toEqual([['large.png']]);
  expect(result.missing).toEqual(['large.png']);
  expect(result.html.length).toBeLessThan(28 * 1024 * 1024);
});

/** Imports can nest; the budget is shared rather than per round. */
it('follows a chain of imports and stops at the round limit', async () => {
  const files: Record<string, [string, string]> = {};
  for (let depth = 0; depth < 12; depth += 1)
    files[`level-${depth}.css`] = [
      'text/css',
      `@import "level-${depth + 1}.css";`,
    ];
  const { read, batches } = reader(files);
  const result = await inlineHtmlAssets(
    '<link rel="stylesheet" href="level-0.css">',
    'index.html',
    read,
  );
  // One request per level of nesting, not one per stylesheet discovered.
  expect(batches.length).toBe(8);
  expect(batches[0]).toEqual(['level-0.css']);
  expect(batches[1]).toEqual(['level-1.css']);
  expect(result.html).toContain('data:text/css');
});
