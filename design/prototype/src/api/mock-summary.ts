/**
 * What the server does when it serves the agent's summary page from its own link:
 * it injects Porcelain's fonts (Geist, Geist Mono) and theme tokens (`--porcelain-*`,
 * as CSS for the system theme, then switched by `#theme=light|dark` so a theme change
 * never reloads the page), and turns `#layer-N` links into a message to the parent
 * page. The mock serves the page as a blob URL; the iframe's sandbox gives it a blank
 * identity either way.
 */

const TOKENS = {
  light: {
    '--porcelain-background': 'oklch(1 0 0)',
    '--porcelain-foreground': 'oklch(0.145 0 0)',
    '--porcelain-card': 'oklch(0.985 0 0)',
    '--porcelain-muted-foreground': 'oklch(0.52 0 0)',
    '--porcelain-border': 'oklch(0.922 0 0)',
    '--porcelain-accent': 'oklch(0.51 0.19 277)',
    '--porcelain-ok': 'oklch(0.55 0.15 150)',
    '--porcelain-warn': 'oklch(0.6 0.13 75)',
    '--porcelain-danger': 'oklch(0.577 0.245 27.325)',
  },
  dark: {
    '--porcelain-background': 'oklch(0.178 0 0)',
    '--porcelain-foreground': 'oklch(0.985 0 0)',
    '--porcelain-card': 'oklch(0.215 0 0)',
    '--porcelain-muted-foreground': 'oklch(0.708 0 0)',
    '--porcelain-border': 'oklch(1 0 0 / 10%)',
    '--porcelain-accent': 'oklch(0.72 0.14 277)',
    '--porcelain-ok': 'oklch(0.72 0.15 150)',
    '--porcelain-warn': 'oklch(0.8 0.13 80)',
    '--porcelain-danger': 'oklch(0.704 0.191 22.216)',
  },
};

const declarations = (values: Record<string, string>) =>
  Object.entries(values)
    .map(([name, value]) => `${name}: ${value};`)
    .join(' ');

/**
 * Porcelain's fonts and tokens, as CSS first: they apply even if the page's scripts
 * never run. `:where` keeps the defaults at zero specificity, so the agent's own CSS
 * always wins.
 */
const INJECTED_STYLE = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Geist+Mono:wght@100..900&display=swap">
<style>
  :root { ${declarations(TOKENS.light)} --porcelain-font: "Geist", ui-sans-serif, system-ui, sans-serif; --porcelain-font-mono: "Geist Mono", ui-monospace, monospace; color-scheme: light; }
  @media (prefers-color-scheme: dark) { :root { ${declarations(TOKENS.dark)} color-scheme: dark; } }
  :where(html) { background: var(--porcelain-background); color: var(--porcelain-foreground); font-family: var(--porcelain-font); -webkit-font-smoothing: antialiased; }
</style>`;

const INJECTED_SCRIPT = `<script>(function () {
  var tokens = ${JSON.stringify(TOKENS)};
  function apply() {
    var match = /theme=(dark|light)/.exec(location.hash);
    if (!match) return;
    var root = document.documentElement;
    var values = tokens[match[1]];
    for (var name in values) root.style.setProperty(name, values[name]);
    root.style.colorScheme = match[1];
  }
  apply();
  addEventListener('hashchange', apply);
  document.addEventListener('click', function (event) {
    var link = event.target && event.target.closest ? event.target.closest('a[href^="#layer-"]') : null;
    if (!link) return;
    event.preventDefault();
    var layer = parseInt(link.getAttribute('href').slice(7), 10);
    if (layer > 0) parent.postMessage({ source: 'porcelain-summary', openLayer: layer }, '*');
  });
})();</script>`;

const INJECTED = `${INJECTED_STYLE}${INJECTED_SCRIPT}`;

/** The page as the server would serve it: the injected script first in `<head>`. */
export function servedSummary(html: string): string {
  return /<head[^>]*>/i.test(html)
    ? html.replace(/<head[^>]*>/i, (head) => `${head}${INJECTED}`)
    : `${INJECTED}${html}`;
}

const links = new Map<string, Promise<string>>();

/**
 * A link for a page or file (HTML with the sandbox header, an image), like the
 * server's own links. The dev server keeps it (`vite.config.ts` → `mockPages`);
 * without it, a blob URL.
 */
export function pageUrl(
  content: string,
  options: { type?: string; base64?: boolean } = {},
): Promise<string> {
  const type = options.type ?? 'text/html';
  const key = `${type}\0${content}`;
  const cached = links.get(key);
  if (cached != null) return cached;
  const headers: Record<string, string> = { 'x-mock-type': type };
  if (options.base64) headers['x-mock-encoding'] = 'base64';
  const link = fetch('/__mock/page', { method: 'POST', body: content, headers })
    .then((response) =>
      response.ok
        ? (response.json() as Promise<{ url: string }>)
        : Promise.reject(new Error('no page server')),
    )
    .then(({ url }) => url)
    .catch(() => {
      const body = options.base64
        ? Uint8Array.from(atob(content), (char) => char.charCodeAt(0))
        : content;
      return URL.createObjectURL(new Blob([body], { type }));
    });
  links.set(key, link);
  return link;
}

/** The summary page's link, with the server's injection. */
export const summaryUrl = (html: string) => pageUrl(servedSummary(html));
