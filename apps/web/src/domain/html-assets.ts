import type { AssetResponse } from '@porcelain/contracts/files';

export const isImagePath = (path: string) =>
  /\.(png|jpe?g|gif|webp|avif|svg|ico)$/i.test(path);
export const assetUrl = (asset: AssetResponse) =>
  `data:${asset.mediaType};base64,${asset.base64}`;

export async function inlineHtmlAssets(
  html: string,
  path: string,
  read: (path: string) => Promise<AssetResponse>,
) {
  const root = 'https://porcelain-preview.invalid/';
  const failures = new Set<string>();
  const cache = new Map<string, string>();
  let count = 0;
  let bytes = 0;
  let expanded = 0;
  const limit = 28 * 1024 * 1024;
  function bounded(url: string) {
    if (url.length > limit - expanded)
      throw new Error('Expanded preview too large');
    expanded += url.length;
    return url;
  }
  function local(value: string, parent: string) {
    if (value.startsWith('data:') || value.startsWith('#')) return null;
    const url = new URL(value, new URL(parent, root));
    if (url.origin !== new URL(root).origin) throw new Error('External asset');
    return { path: decodeURIComponent(url.pathname.slice(1)), hash: url.hash };
  }
  async function asset(
    value: string,
    parent: string,
    ancestors: string[] = [],
  ): Promise<string> {
    try {
      const resolved = local(value, parent);
      if (resolved === null) return bounded(value);
      const { path, hash } = resolved;
      if (ancestors.includes(path)) throw new Error('Circular stylesheet');
      const known = cache.get(path);
      if (known) return bounded(known + hash);
      if (++count > 64) throw new Error('Too many assets');
      const result = await read(path);
      bytes += result.base64.length;
      if (bytes > limit) throw new Error('Preview too large');
      let url = assetUrl(result);
      if (result.mediaType === 'text/css') {
        const text = new TextDecoder().decode(
          Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0)),
        );
        const css = await styles(text, path, [...ancestors, path]);
        // Percent encoding can use up to nine characters per UTF-16 unit.
        if (css.length > (limit - expanded) / 9)
          throw new Error('Expanded stylesheet too large');
        url = `data:text/css;charset=utf-8,${encodeURIComponent(css)}`;
      }
      const reference = bounded(url + hash);
      cache.set(path, url);
      return reference;
    } catch {
      failures.add(value);
      return 'data:,';
    }
  }
  async function styles(css: string, parent: string, ancestors: string[] = []) {
    const pattern =
      /url\(\s*(['"]?)([^)'"]+)\1\s*\)|@import\s+(['"])([^'"]+)\3/g;
    let result = '';
    let end = 0;
    for (const match of css.matchAll(pattern)) {
      result += css.slice(end, match.index);
      const url = await asset(
        (match[2] ?? match[4] ?? '').trim(),
        parent,
        ancestors,
      );
      result += match[4] ? `@import url("${url}")` : `url("${url}")`;
      end = match.index + match[0].length;
    }
    return result + css.slice(end);
  }
  const document = new DOMParser().parseFromString(html, 'text/html');
  document.querySelectorAll('base, meta[http-equiv]').forEach((node) => {
    node.remove();
  });
  for (const node of document.querySelectorAll(
    'link[href], img[src], script[src], source[src], video[poster], image[href]',
  )) {
    const attr = node.hasAttribute('href')
      ? 'href'
      : node.hasAttribute('poster')
        ? 'poster'
        : 'src';
    node.setAttribute(attr, await asset(node.getAttribute(attr) ?? '', path));
    node.removeAttribute('integrity');
    node.removeAttribute('crossorigin');
  }
  for (const node of document.querySelectorAll('[srcset]')) {
    const candidates: string[] = [];
    const source = node.getAttribute('srcset') ?? '';
    const pattern = /(data:[^\s]+|[^,\s]+)(?:\s+(\d+(?:\.\d+)?[wx]))?\s*,?/g;
    for (const match of source.matchAll(pattern)) {
      const url = await asset((match[1] ?? '').replace(/,$/, ''), path);
      candidates.push(`${url}${match[2] ? ` ${match[2]}` : ''}`);
    }
    node.setAttribute('srcset', candidates.join(', '));
  }
  for (const node of document.querySelectorAll('style'))
    node.textContent = await styles(node.textContent ?? '', path);
  for (const node of document.querySelectorAll('[style]'))
    node.setAttribute(
      'style',
      await styles(node.getAttribute('style') ?? '', path),
    );
  const policy = document.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content =
    "default-src 'none'; script-src 'unsafe-inline' data:; style-src 'unsafe-inline' data:; img-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'";
  document.head.prepend(policy);
  return {
    html: `<!doctype html>${document.documentElement.outerHTML}`,
    missing: [...failures],
  };
}
