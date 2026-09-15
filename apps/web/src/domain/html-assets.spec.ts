import { expect, it } from 'vitest';
import { inlineHtmlAssets } from './html-assets';

it('resolves nested stylesheets and their local images relative to each asset', async () => {
  const files: Record<string, [string, string]> = {
    'site/css/main.css': [
      'text/css',
      '@import "./theme.css"; body { background: url("../photo.png") }',
    ],
    'site/css/theme.css': ['text/css', 'body { color: rgb(10, 20, 30) }'],
    'site/photo.png': ['image/png', 'image bytes'],
  };
  const paths: string[] = [];
  const result = await inlineHtmlAssets(
    '<link rel="stylesheet" href="css/main.css"><img src="photo.png">',
    'site/index.html',
    async (path) => {
      paths.push(path);
      const file = files[path];
      if (!file) throw new Error(path);
      return { path, mediaType: file[0], base64: btoa(file[1]) };
    },
  );
  expect(result.missing).toEqual([]);
  expect(paths).toEqual([
    'site/css/main.css',
    'site/css/theme.css',
    'site/photo.png',
  ]);
  expect(result.html).toContain('data:text/css');
  expect(result.html).toContain('data:image/png;base64,');
  expect(result.html).toContain("connect-src 'none'");
});

it('reports missing and external assets and terminates cyclic CSS imports', async () => {
  const result = await inlineHtmlAssets(
    '<base href="https://other.invalid"><link rel="stylesheet" href="a.css"><img src="https://external.invalid/a.png"><img src="missing.png">',
    'index.html',
    async (path) => {
      if (path !== 'a.css') throw new Error('missing');
      return { path, mediaType: 'text/css', base64: btoa('@import "a.css";') };
    },
  );
  expect(result.missing).toEqual([
    'a.css',
    'https://external.invalid/a.png',
    'missing.png',
  ]);
  expect(result.html).not.toContain('<base');
});

it('keeps responsive image candidates and SVG fragment targets', async () => {
  const result = await inlineHtmlAssets(
    '<picture><source srcset="small.svg#small 1x, large.svg#large 2x"><img srcset="fallback.svg 320w"></picture><style>div { filter: url("filters.svg#shadow") }</style>',
    'index.html',
    async (path) => ({
      path,
      mediaType: 'image/svg+xml',
      base64: btoa('<svg/>'),
    }),
  );
  expect(result.missing).toEqual([]);
  expect(result.html).toContain(
    'data:image/svg+xml;base64,PHN2Zy8+#small 1x, data:image/svg+xml;base64,PHN2Zy8+#large 2x',
  );
  expect(result.html).toContain('data:image/svg+xml;base64,PHN2Zy8+ 320w');
  expect(result.html).toContain('data:image/svg+xml;base64,PHN2Zy8+#shadow');
});

it('bounds expanded output when a cached asset is referenced repeatedly', async () => {
  let reads = 0;
  const result = await inlineHtmlAssets(
    '<img src="large.png">'.repeat(40),
    'index.html',
    async (path) => {
      reads++;
      return { path, mediaType: 'image/png', base64: 'A'.repeat(1024 * 1024) };
    },
  );
  expect(reads).toBe(1);
  expect(result.missing).toEqual(['large.png']);
  expect(result.html.length).toBeLessThan(28 * 1024 * 1024);
});
