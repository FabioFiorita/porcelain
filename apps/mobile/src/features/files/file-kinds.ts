const MARKDOWN_EXTENSIONS = new Set(['md', 'mdx', 'markdown'])
const HTML_EXTENSIONS = new Set(['html', 'htm'])

function extensionOf(path: string): string {
  // Basename first, so a dot in a directory name cannot be read as the extension.
  const base = path.split('/').at(-1) ?? ''
  const dot = base.lastIndexOf('.')
  return dot <= 0 ? '' : base.slice(dot + 1).toLowerCase()
}

/** Files the viewer offers a reader for. Same extensions the desktop viewer answers to. */
export function isMarkdownPath(path: string): boolean {
  return MARKDOWN_EXTENSIONS.has(extensionOf(path))
}

/** Files the viewer offers a sandboxed preview for. */
export function isHtmlPath(path: string): boolean {
  return HTML_EXTENSIONS.has(extensionOf(path))
}
