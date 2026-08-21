import MarkdownIt from 'markdown-it'

import { themeVarsFor } from '@/features/settings/theme-vars'

/**
 * Markdown → HTML, GFM-ish and safe by construction.
 *
 * `html: false` drops raw HTML embedded in the markdown rather than passing it through: a repo
 * file is not trusted input, and the preview it renders in has scripting off but no reason to
 * carry someone's `<iframe>` either. Tables, fenced code and strikethrough are core markdown-it;
 * `linkify` picks up bare URLs the way the desktop's remark-gfm does.
 */
const markdown = new MarkdownIt({ breaks: false, html: false, linkify: true, typographer: false })

export function markdownToHtml(source: string): string {
  return markdown.render(source)
}

/**
 * Colours the preview paints. The WebView cannot see NativeWind classes, so the semantic
 * tokens are read from the same maps the CSS variables come from (`@porcelain/ui` tokens.css).
 */
function themeFor(scheme: 'light' | 'dark'): {
  background: string
  border: string
  code: string
  foreground: string
  link: string
  muted: string
} {
  const vars = themeVarsFor(scheme)
  return {
    background: vars.background ?? '#FFFFFF',
    border: vars.border ?? '#E5E5E5',
    code: vars.muted ?? '#F5F5F5',
    foreground: vars.foreground ?? '#0A0A0A',
    // `primary` is now near-black/near-white, which reads as body text; links use `info`.
    link: vars.info ?? '#0084D1',
    muted: vars['muted-foreground'] ?? '#737373',
  }
}

/**
 * Everything the preview is allowed to do, declared in the document itself.
 *
 * `default-src 'none'` with only inline styles, data-URI images, data-URI media, and data-URI fonts is the
 * mobile twin of the renderer's `sandbox=""` iframe: no network, no scripts, no frames. The
 * daemon has already inlined a previewed file's local images as data URIs (`previewHtml`), so
 * this blocks exactly the remote fetches that would turn opening a repo file into a beacon.
 */
const CSP =
  "default-src 'none'; img-src data:; media-src data:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'"

function styles(scheme: 'light' | 'dark'): string {
  const t = themeFor(scheme)
  return `
    :root { color-scheme: ${scheme}; }
    html { -webkit-text-size-adjust: 100%; }
    body {
      margin: 0; padding: 16px 18px 48px;
      background: ${t.background}; color: ${t.foreground};
      font: 15px/1.6 -apple-system, system-ui, "Segoe UI", Roboto, sans-serif;
      overflow-wrap: break-word; word-break: break-word;
    }
    h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 1.6em 0 0.6em; font-weight: 650; }
    h1 { font-size: 1.6em; } h2 { font-size: 1.35em; } h3 { font-size: 1.15em; }
    h1, h2 { border-bottom: 1px solid ${t.border}; padding-bottom: 0.3em; }
    :is(h1, h2, h3, h4, h5, h6):first-child { margin-top: 0; }
    p, ul, ol, blockquote, table, pre { margin: 0 0 1em; }
    a { color: ${t.link}; }
    code {
      background: ${t.code}; border-radius: 4px; padding: 0.15em 0.35em;
      font-family: ui-monospace, Menlo, monospace; font-size: 0.88em;
    }
    pre {
      background: ${t.code}; border-radius: 10px; padding: 12px 14px;
      overflow-x: auto; -webkit-overflow-scrolling: touch;
    }
    pre code { background: none; padding: 0; font-size: 0.85em; line-height: 1.5; }
    blockquote {
      border-left: 3px solid ${t.border}; color: ${t.muted};
      margin-left: 0; padding: 0.1em 0 0.1em 1em;
    }
    hr { border: 0; border-top: 1px solid ${t.border}; margin: 2em 0; }
    table { border-collapse: collapse; display: block; overflow-x: auto; width: 100%; }
    th, td { border: 1px solid ${t.border}; padding: 6px 10px; text-align: left; }
    th { background: ${t.code}; }
    img { max-width: 100%; height: auto; }
    ul, ol { padding-left: 1.4em; }
    li + li { margin-top: 0.25em; }
  `
}

/** A rendered markdown fragment, wrapped as a document the preview can load. */
export function readerDocument(html: string, scheme: 'light' | 'dark'): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<style>${styles(scheme)}</style></head><body>${html}</body></html>`
}

const VIEWPORT =
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
const POLICY = `<meta http-equiv="Content-Security-Policy" content="${CSP}">`

/**
 * A whole HTML file, made readable on a phone without editing what it says.
 *
 * Only two things are injected — a viewport so a desktop-width page is not rendered at 980px
 * and then scaled to unreadable, and the same policy the reader carries. A file that already
 * declares its own viewport keeps it. The policy goes first in `<head>` because a meta CSP only
 * governs what comes after it.
 */
export function previewDocument(html: string): string {
  const hasViewport = /<meta\b[^>]*\bname\s*=\s*["']viewport["']/i.test(html)
  const injected = POLICY + (hasViewport ? '' : VIEWPORT)
  const head = /<head\b[^>]*>/i
  if (head.test(html)) return html.replace(head, (tag) => tag + injected)
  const htmlTag = /<html\b[^>]*>/i
  if (htmlTag.test(html)) return html.replace(htmlTag, (tag) => `${tag}<head>${injected}</head>`)
  return `<!doctype html><html><head>${injected}</head><body>${html}</body></html>`
}
