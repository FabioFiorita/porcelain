/**
 * A small CommonMark-ish renderer for the mobile markdown reader. No GFM tables or footnotes —
 * enough to read a README or agent note without pulling a React DOM markdown stack onto iOS.
 * Source mode uses Shiki; this path only paints the reader.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inlineMarkdown(text: string): string {
  let result = escapeHtml(text)
  // Inline code first so emphasis markers inside code stay literal.
  result = result.replace(/`([^`]+)`/g, (_match, code: string) => `<code>${code}</code>`)
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  result = result.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
  result = result.replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>')
  result = result.replace(
    /\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
    '<a href="$2" rel="noreferrer">$1</a>',
  )
  return result
}

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'code'; lang: string; text: string }
  | { kind: 'blockquote'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'hr' }
  | { kind: 'p'; text: string }

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''

    if (line.trim() === '') {
      index += 1
      continue
    }

    const fence = line.match(/^```([\w-]*)\s*$/)
    if (fence !== null) {
      const lang = fence[1] ?? ''
      const body: string[] = []
      index += 1
      while (index < lines.length && !/^```\s*$/.test(lines[index] ?? '')) {
        body.push(lines[index] ?? '')
        index += 1
      }
      if (index < lines.length) index += 1
      blocks.push({ kind: 'code', lang, text: body.join('\n') })
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading !== null) {
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2].trim() })
      index += 1
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      blocks.push({ kind: 'hr' })
      index += 1
      continue
    }

    if (/^>\s?/.test(line)) {
      const quoted: string[] = []
      while (index < lines.length && /^>\s?/.test(lines[index] ?? '')) {
        quoted.push((lines[index] ?? '').replace(/^>\s?/, ''))
        index += 1
      }
      blocks.push({ kind: 'blockquote', text: quoted.join('\n') })
      continue
    }

    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^[-*+]\s+/.test(lines[index] ?? '')) {
        items.push((lines[index] ?? '').replace(/^[-*+]\s+/, ''))
        index += 1
      }
      blocks.push({ kind: 'ul', items })
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\d+\.\s+/.test(lines[index] ?? '')) {
        items.push((lines[index] ?? '').replace(/^\d+\.\s+/, ''))
        index += 1
      }
      blocks.push({ kind: 'ol', items })
      continue
    }

    const paragraph: string[] = [line]
    index += 1
    while (
      index < lines.length &&
      (lines[index] ?? '').trim() !== '' &&
      !/^(#{1,6}\s|```|[-*+]\s|\d+\.\s|>|(-{3,}|\*{3,}|_{3,})\s*$)/.test(lines[index] ?? '')
    ) {
      paragraph.push(lines[index] ?? '')
      index += 1
    }
    blocks.push({ kind: 'p', text: paragraph.join(' ') })
  }

  return blocks
}

function renderBlock(block: Block): string {
  switch (block.kind) {
    case 'heading':
      return `<h${block.level}>${inlineMarkdown(block.text)}</h${block.level}>`
    case 'code':
      return `<pre><code class="language-${escapeHtml(block.lang)}">${escapeHtml(block.text)}</code></pre>`
    case 'blockquote':
      return `<blockquote>${block.text
        .split('\n')
        .map((line) => `<p>${inlineMarkdown(line)}</p>`)
        .join('')}</blockquote>`
    case 'ul':
      return `<ul>${block.items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</ul>`
    case 'ol':
      return `<ol>${block.items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</ol>`
    case 'hr':
      return '<hr>'
    case 'p':
      return `<p>${inlineMarkdown(block.text)}</p>`
  }
}

/** Convert markdown source to an HTML fragment (no document chrome). */
export function markdownToHtml(source: string): string {
  return parseBlocks(source).map(renderBlock).join('\n')
}

const VIEWPORT_META =
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'

/** Full HTML document for the sandboxed reader WebView, themed to the system appearance. */
export function wrapMarkdownReaderHtml(bodyHtml: string, scheme: 'light' | 'dark'): string {
  const background = scheme === 'dark' ? '#000000' : '#FFFFFF'
  const text = scheme === 'dark' ? '#EDEDED' : '#1C1C1E'
  const muted = scheme === 'dark' ? '#8E8E93' : '#6C6C70'
  const codeBg = scheme === 'dark' ? '#1C1C1E' : '#F2F2F7'
  const border = scheme === 'dark' ? '#2C2C2E' : '#D1D1D6'
  const link = scheme === 'dark' ? '#00A6F4' : '#0084D1'
  const quoteBg = scheme === 'dark' ? '#141416' : '#F2F2F7'

  return `<!doctype html>
<html>
<head>
${VIEWPORT_META}
<meta charset="utf-8">
<style>
  :root { color-scheme: ${scheme}; }
  html, body {
    margin: 0;
    padding: 0;
    background: ${background};
    color: ${text};
    font: -apple-system-body;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    line-height: 1.5;
    -webkit-text-size-adjust: 100%;
  }
  article {
    max-width: 42rem;
    margin: 0 auto;
    padding: 16px 18px 32px;
  }
  h1, h2, h3, h4, h5, h6 {
    line-height: 1.25;
    margin: 1.25em 0 0.5em;
    font-weight: 600;
  }
  h1 { font-size: 1.6em; margin-top: 0; }
  h2 { font-size: 1.3em; }
  h3 { font-size: 1.15em; }
  p, ul, ol, blockquote, pre { margin: 0 0 0.9em; }
  a { color: ${link}; text-decoration: none; }
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.9em;
    background: ${codeBg};
    padding: 0.1em 0.35em;
    border-radius: 4px;
  }
  pre {
    background: ${codeBg};
    border: 1px solid ${border};
    border-radius: 8px;
    padding: 12px;
    overflow-x: auto;
  }
  pre code {
    background: transparent;
    padding: 0;
    font-size: 0.85em;
  }
  blockquote {
    margin-left: 0;
    padding: 8px 12px;
    border-left: 3px solid ${link};
    background: ${quoteBg};
    color: ${muted};
  }
  blockquote p:last-child { margin-bottom: 0; }
  hr {
    border: 0;
    border-top: 1px solid ${border};
    margin: 1.5em 0;
  }
  ul, ol { padding-left: 1.4em; }
  li { margin: 0.25em 0; }
</style>
</head>
<body><article>${bodyHtml}</article></body>
</html>`
}
