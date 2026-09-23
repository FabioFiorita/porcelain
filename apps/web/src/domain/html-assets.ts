import type { AssetResponse } from '@porcelain/contracts/files';

export const isImagePath = (path: string) =>
  /\.(png|jpe?g|gif|webp|avif|svg|ico)$/i.test(path);
export const assetUrl = (asset: AssetResponse) =>
  `data:${asset.mediaType};base64,${asset.base64}`;

export type ReadAssets = (
  paths: string[],
) => Promise<Map<string, AssetResponse | null>>;

const MAX_ASSETS = 64;
const MAX_BYTES = 28 * 1024 * 1024;
const MAX_ROUNDS = 8;
const STYLE_REFERENCE =
  /url\(\s*(['"]?)([^)'"]+)\1\s*\)|@import\s+(['"])([^'"]+)\3/g;

export async function inlineHtmlAssets(
  html: string,
  path: string,
  readAssets: ReadAssets,
) {
  const origin = 'https://porcelain-preview.invalid/';
  const folder = path.includes('/')
    ? `${path.slice(0, path.lastIndexOf('/'))}/`
    : '';
  const base = new URL(folder, origin);
  const failures = new Set<string>();
  const assets = new Map<string, AssetResponse | null>();
  let bytes = 0;
  let expanded = 0;

  function resolve(value: string, parent: string) {
    if (value.startsWith('data:') || value.startsWith('#')) return null;
    const url = new URL(value, new URL(parent, origin));
    if (url.origin !== base.origin) throw new Error('External asset');
    if (!url.pathname.startsWith(base.pathname))
      throw new Error('Outside the document folder');
    return { path: decodeURIComponent(url.pathname.slice(1)), hash: url.hash };
  }

  function cssReferences(css: string, parent: string) {
    const found: string[] = [];
    for (const match of css.matchAll(STYLE_REFERENCE)) {
      const value = (match[2] ?? match[4] ?? '').trim();
      try {
        const resolved = resolve(value, parent);
        if (resolved) found.push(resolved.path);
      } catch {
        failures.add(value);
      }
    }
    return found;
  }

  function decode(asset: AssetResponse) {
    return new TextDecoder().decode(
      Uint8Array.from(atob(asset.base64), (character) =>
        character.charCodeAt(0),
      ),
    );
  }

  async function collect(initial: string[]) {
    let wanted = initial;
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const fresh = [...new Set(wanted)].filter(
        (candidate) => !assets.has(candidate),
      );
      if (fresh.length === 0) return;
      const room = MAX_ASSETS - assets.size;
      if (room <= 0) {
        for (const candidate of fresh) assets.set(candidate, null);
        return;
      }
      const batch = fresh.slice(0, room);
      for (const candidate of fresh.slice(room)) assets.set(candidate, null);
      const answered = await readAssets(batch);
      const next: string[] = [];
      for (const candidate of batch) {
        const asset = answered.get(candidate) ?? null;
        if (asset === null) {
          assets.set(candidate, null);
          continue;
        }
        bytes += asset.base64.length;
        if (bytes > MAX_BYTES) {
          assets.set(candidate, null);
          continue;
        }
        assets.set(candidate, asset);
        if (asset.mediaType === 'text/css')
          next.push(...cssReferences(decode(asset), candidate));
      }
      wanted = next;
    }
  }

  function reference(value: string, parent: string, ancestors: string[]) {
    try {
      const resolved = resolve(value, parent);
      if (resolved === null) return value;
      const asset = assets.get(resolved.path);
      if (!asset) throw new Error('Unavailable');
      if (ancestors.includes(resolved.path))
        throw new Error('Circular stylesheet');
      const url =
        asset.mediaType === 'text/css'
          ? `data:text/css;charset=utf-8,${encodeURIComponent(
              rewriteStyles(decode(asset), resolved.path, [
                ...ancestors,
                resolved.path,
              ]),
            )}`
          : assetUrl(asset);
      const reference = url + resolved.hash;
      if (expanded + reference.length > MAX_BYTES)
        throw new Error('Expanded preview too large');
      expanded += reference.length;
      return reference;
    } catch {
      failures.add(value);
      return 'data:,';
    }
  }

  function rewriteStyles(
    css: string,
    parent: string,
    ancestors: string[] = [],
  ) {
    let result = '';
    let end = 0;
    for (const match of css.matchAll(STYLE_REFERENCE)) {
      result += css.slice(end, match.index);
      const url = reference(
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
  for (const node of document.querySelectorAll('base, meta[http-equiv]'))
    node.remove();

  const elements = [
    ...document.querySelectorAll(
      'link[href], img[src], script[src], source[src], video[poster], image[href]',
    ),
  ].map((node) => ({
    node,
    attribute: node.hasAttribute('href')
      ? 'href'
      : node.hasAttribute('poster')
        ? 'poster'
        : 'src',
  }));
  const sets = [...document.querySelectorAll('[srcset]')];
  const inlineStyles = [
    ...document.querySelectorAll('style'),
    ...document.querySelectorAll('[style]'),
  ];

  const wanted: string[] = [];
  const collectValue = (value: string) => {
    try {
      const resolved = resolve(value, path);
      if (resolved) wanted.push(resolved.path);
    } catch {
      failures.add(value);
    }
  };
  for (const { node, attribute } of elements)
    collectValue(node.getAttribute(attribute) ?? '');
  for (const node of sets)
    for (const candidate of srcsetCandidates(node.getAttribute('srcset') ?? ''))
      collectValue(candidate.url);
  for (const node of inlineStyles)
    wanted.push(
      ...cssReferences(
        node.tagName === 'STYLE'
          ? (node.textContent ?? '')
          : (node.getAttribute('style') ?? ''),
        path,
      ),
    );
  await collect(wanted);

  for (const { node, attribute } of elements) {
    node.setAttribute(
      attribute,
      reference(node.getAttribute(attribute) ?? '', path, []),
    );
    node.removeAttribute('integrity');
    node.removeAttribute('crossorigin');
  }
  for (const node of sets)
    node.setAttribute(
      'srcset',
      srcsetCandidates(node.getAttribute('srcset') ?? '')
        .map(
          (candidate) =>
            `${reference(candidate.url, path, [])}${
              candidate.descriptor ? ` ${candidate.descriptor}` : ''
            }`,
        )
        .join(', '),
    );
  for (const node of document.querySelectorAll('style'))
    node.textContent = rewriteStyles(node.textContent ?? '', path);
  for (const node of document.querySelectorAll('[style]'))
    node.setAttribute(
      'style',
      rewriteStyles(node.getAttribute('style') ?? '', path),
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

function srcsetCandidates(source: string) {
  const pattern = /(data:[^\s]+|[^,\s]+)(?:\s+(\d+(?:\.\d+)?[wx]))?\s*,?/g;
  return [...source.matchAll(pattern)].map((match) => ({
    url: (match[1] ?? '').replace(/,$/, ''),
    descriptor: match[2] ?? '',
  }));
}
