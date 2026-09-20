import type { AssetResponse } from '@porcelain/contracts/files';

export const isImagePath = (path: string) =>
  /\.(png|jpe?g|gif|webp|avif|svg|ico)$/i.test(path);
export const assetUrl = (asset: AssetResponse) =>
  `data:${asset.mediaType};base64,${asset.base64}`;

/** Reads several assets at once; a path it cannot serve comes back null. */
export type ReadAssets = (
  paths: string[],
) => Promise<Map<string, AssetResponse | null>>;

const MAX_ASSETS = 64;
const MAX_BYTES = 28 * 1024 * 1024;
/** Stylesheets can import stylesheets; this many rounds of discovery, at most. */
const MAX_ROUNDS = 8;
const STYLE_REFERENCE =
  /url\(\s*(['"]?)([^)'"]+)\1\s*\)|@import\s+(['"])([^'"]+)\3/g;

/**
 * Rewrite a previewed HTML file so every local asset it names is carried
 * inside it as a `data:` URL, and it loads nothing from the network. Loading
 * is not all a document can do: see the policy at the end of this file for
 * what the preview still cannot promise.
 *
 * References are resolved against the document's own folder and anything that
 * leaves it is refused. The browser resolves `../secrets.js` before the server
 * ever sees it, so a reference that climbed out of the folder would arrive
 * looking like an ordinary path — without this bound a previewed file could
 * make Porcelain read any allow-listed file in the worktree. The server
 * refuses the same paths again; this is the half that can explain itself to
 * the reader.
 *
 * Assets are discovered in rounds and read a round at a time: everything the
 * document names, then everything its stylesheets named, and so on. Nested
 * imports still work, and a document with sixty-four assets costs two or three
 * requests rather than sixty-four.
 */
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
  /** Null once a path is known to be unavailable. */
  const assets = new Map<string, AssetResponse | null>();
  /** What has been read, against the budget for reading. */
  let bytes = 0;
  /**
   * What has been written into the document, against the budget for its size.
   * One asset referenced forty times is read once and written forty times, so
   * the two are counted separately: the read budget alone would let a small
   * file inflate the preview past the cap this promises.
   */
  let expanded = 0;

  /** The path a reference points at, or null when it is not ours to fetch. */
  function resolve(value: string, parent: string) {
    if (value.startsWith('data:') || value.startsWith('#')) return null;
    const url = new URL(value, new URL(parent, origin));
    if (url.origin !== base.origin) throw new Error('External asset');
    if (!url.pathname.startsWith(base.pathname))
      throw new Error('Outside the document folder');
    return { path: decodeURIComponent(url.pathname.slice(1)), hash: url.hash };
  }

  /** Every reference in one CSS text, as paths. */
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

  /**
   * Read what is wanted, then whatever the stylesheets among them named, until
   * nothing new appears. The count and byte budgets are shared across rounds,
   * so a chain of imports cannot spend more than a flat document could.
   */
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

  /** A reference's replacement, once everything has been read. */
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
  // A supplied base would re-point every relative URL, and supplied
  // http-equiv metadata could replace the policy prepended below.
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

  // One pass to find out what the document needs, then the reads, then the
  // rewrite. Rewriting as we went is what made this one request per asset.
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
  // `data:` and nothing else, so no subresource, fetch, XHR or form submission
  // reaches the network, and with the sandbox the document cannot touch
  // Porcelain or move the page around it. What none of this stops is the frame
  // navigating *itself*: `connect-src` governs fetch and XHR, `form-action`
  // governs forms, and the directive that governed navigation was removed from
  // the specification. A script can put what it can see into an address and go
  // there. That channel is accepted and written down in
  // docs/decisions/html-preview-sandbox.md.
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
