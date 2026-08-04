const MARKDOWN_EXTENSIONS = new Set(['md', 'mdx', 'markdown'])
const HTML_EXTENSIONS = new Set(['html', 'htm'])

function extensionOf(path: string): string {
  const base = path.split(/[/\\]/).at(-1) ?? ''
  const cut = base.lastIndexOf('.')
  return cut === -1 ? '' : base.slice(cut + 1).toLowerCase()
}

export function isMarkdownPath(path: string): boolean {
  return MARKDOWN_EXTENSIONS.has(extensionOf(path))
}

export function isHtmlPath(path: string): boolean {
  return HTML_EXTENSIONS.has(extensionOf(path))
}
