import { Effect } from 'effect';
import { collectHtmlAssets } from '@porcelain/client/files';
import type {
  PreviewAssetFailure,
  PreviewAssetSource,
} from '@porcelain/client/files';
import { PREVIEW_BRIDGE_SCRIPT } from '@porcelain/client/files/rules';
import { repositoryReference } from '@porcelain/client/links/rules';
import type { ReadFileAssetResponse as AssetResponse } from '@porcelain/contracts/files';
import { FILE_PREVIEW_MAX_BYTES } from '@/config/limits';

import { assetUrl } from '../rules/html-assets';

type ReadAssets = (
  paths: string[],
) => Effect.Effect<Map<string, PreviewAssetSource | null>, PreviewAssetFailure>;

const STYLE_REFERENCE =
  /url\(\s*(['"]?)([^)'"]+)\1\s*\)|@import\s+(?:url\(\s*)?(['"])([^'"]+)\3\s*\)?\s*([^;]*);?/g;

const PREVIEW_POLICY =
  "default-src 'none'; script-src 'unsafe-inline' data:; style-src 'unsafe-inline' data:; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'";

function previewPolicy(mediaSources: readonly string[]) {
  const sources = mediaSources.join(' ');
  return mediaSources.length === 0
    ? PREVIEW_POLICY
    : PREVIEW_POLICY.replace(
        'img-src data: blob:;',
        `img-src data: blob: ${sources};`,
      ).replace('media-src data: blob:;', `media-src data: blob: ${sources};`);
}

const MEDIA =
  'img[src], script[src], source[src], video[src], audio[src], track[src], video[poster], image[href], input[type="image"][src]';

export function htmlFrameDocument(
  html: string,
  scripts: { run: true } | { run: false; nonce: string },
  mediaSources: readonly string[],
) {
  const document = window.document.implementation.createHTMLDocument();
  const policy = document.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content = scripts.run
    ? previewPolicy(mediaSources)
    : previewPolicy(mediaSources).replace(
        "script-src 'unsafe-inline' data:",
        `script-src 'nonce-${scripts.nonce}'`,
      );
  const style = document.createElement('style');
  style.textContent =
    'html, body { height: 100%; margin: 0; } iframe { display: block; width: 100%; height: 100%; border: 0; color-scheme: inherit; }';
  document.head.replaceChildren(policy, style);
  document.documentElement.style.colorScheme = 'light dark';
  const frame = document.createElement('iframe');
  frame.title = 'Preview content';
  frame.setAttribute('aria-label', 'Preview content');
  frame.sandbox.add('allow-scripts');
  frame.referrerPolicy = 'no-referrer';
  frame.srcdoc = html;
  document.body.append(frame);
  return `<!doctype html>${document.documentElement.outerHTML}`;
}

export const inlineHtmlAssets = Effect.fn('BrowserHtmlPreview.inlineAssets')(
  function* (html: string, path: string, readAssets: ReadAssets) {
    const failures = new Set<string>();
    let assets = new Map<string, PreviewAssetSource | null>();
    let expanded = 0;

    function resolve(value: string, parent: string) {
      if (value.startsWith('data:')) return null;
      const reference = repositoryReference(parent, value);
      if (reference.kind === 'fragment') return null;
      if (reference.kind !== 'repository')
        throw new Error('Not in the repository');
      return reference;
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

    function budget(length: number) {
      if (expanded + length > FILE_PREVIEW_MAX_BYTES)
        throw new Error('Expanded preview too large');
      expanded += length;
    }

    function stylesheet(value: string, parent: string, ancestors: string[]) {
      const resolved = resolve(value, parent);
      if (resolved === null) return '';
      const asset = assets.get(resolved.path);
      if (!asset || 'url' in asset || asset.mediaType !== 'text/css')
        throw new Error('Unavailable');
      if (ancestors.includes(resolved.path))
        throw new Error('Circular stylesheet');
      const css = rewriteStyles(decode(asset), resolved.path, [
        ...ancestors,
        resolved.path,
      ]);
      budget(css.length);
      return css;
    }

    function reference(value: string, parent: string) {
      try {
        const resolved = resolve(value, parent);
        if (resolved === null) return value;
        const asset = assets.get(resolved.path);
        if (!asset || ('mediaType' in asset && asset.mediaType === 'text/css'))
          throw new Error('Unavailable');
        const url = assetUrl(asset) + resolved.hash;
        budget(url.length);
        return url;
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
        if (match[4] !== undefined) {
          const media = (match[5] ?? '').trim();
          try {
            const imported = stylesheet(match[4].trim(), parent, ancestors);
            result += media ? `@media ${media} {\n${imported}\n}` : imported;
          } catch {
            failures.add(match[4].trim());
          }
        } else {
          result += `url("${reference((match[2] ?? '').trim(), parent)}")`;
        }
        end = match.index + match[0].length;
      }
      return result + css.slice(end);
    }

    const document = new DOMParser().parseFromString(html, 'text/html');
    for (const node of document.querySelectorAll('base, meta[http-equiv]'))
      node.remove();

    const links = [...document.querySelectorAll('link[href]')];
    const sheets = links.filter((node) =>
      (node.getAttribute('rel') ?? '')
        .toLowerCase()
        .split(/\s+/)
        .includes('stylesheet'),
    );
    const icons = links.filter((node) =>
      (node.getAttribute('rel') ?? '')
        .toLowerCase()
        .split(/\s+/)
        .includes('icon'),
    );
    for (const node of links)
      if (!sheets.includes(node) && !icons.includes(node)) node.remove();

    const elements = [
      ...[...document.querySelectorAll(MEDIA)].flatMap((node) =>
        ['src', 'poster', 'href']
          .filter(
            (attribute) =>
              node.hasAttribute(attribute) &&
              !(attribute === 'href' && node.tagName.toLowerCase() !== 'image'),
          )
          .map((attribute) => ({ node, attribute })),
      ),
      ...icons.map((node) => ({ node, attribute: 'href' })),
    ];
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
    for (const node of sheets) collectValue(node.getAttribute('href') ?? '');
    for (const node of sets)
      for (const candidate of srcsetCandidates(
        node.getAttribute('srcset') ?? '',
      ))
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
    assets = yield* collectHtmlAssets(wanted, readAssets, cssReferences);

    for (const { node, attribute } of elements) {
      node.setAttribute(
        attribute,
        reference(node.getAttribute(attribute) ?? '', path),
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
              `${reference(candidate.url, path)}${
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
    for (const node of sheets) {
      const href = node.getAttribute('href') ?? '';
      const style = document.createElement('style');
      const media = node.getAttribute('media');
      if (media) style.media = media;
      try {
        style.textContent = stylesheet(href, path, []);
        node.replaceWith(style);
      } catch {
        failures.add(href);
        node.remove();
      }
    }

    const written = new Set(
      [...document.querySelectorAll('a[href], area[href]')].map(
        (node) => node.getAttribute('href') ?? '',
      ),
    );

    const policy = document.createElement('meta');
    policy.httpEquiv = 'Content-Security-Policy';
    const mediaSources = [
      ...new Set(
        [...assets.values()].flatMap((asset) => {
          if (!asset || !('url' in asset)) return [];
          const url = new URL(asset.url);
          return [`${url.protocol}//${url.host}${url.pathname}`];
        }),
      ),
    ];
    policy.content = previewPolicy(mediaSources);
    const nonce = crypto.randomUUID();
    const bridge = document.createElement('script');
    bridge.setAttribute('nonce', nonce);
    bridge.textContent = PREVIEW_BRIDGE_SCRIPT;
    document.head.prepend(policy, bridge);
    return {
      html: `<!doctype html>${document.documentElement.outerHTML}`,
      missing: [...failures],
      links: [...written],
      nonce,
      mediaSources,
    };
  },
);

function srcsetCandidates(source: string) {
  const pattern = /(data:[^\s]+|[^,\s]+)(?:\s+(\d+(?:\.\d+)?[wx]))?\s*,?/g;
  return [...source.matchAll(pattern)].map((match) => ({
    url: (match[1] ?? '').replace(/,$/, ''),
    descriptor: match[2] ?? '',
  }));
}
