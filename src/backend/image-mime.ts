/**
 * Image MIME lookup by file extension + cheap binary sniff for buffers.
 * Shared by the file viewer (`readFile`) and diff preview so a PNG/WebP never
 * falls through to "decode as UTF-8 text" (the garbled �PNG dump).
 */

const IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
  avif: 'image/avif',
}

/** Extension (no dot) → MIME, or null when the path isn't a known image type. */
export function imageMimeForPath(filePath: string): string | null {
  const base = filePath.split(/[/\\]/).at(-1) ?? filePath
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return null
  const ext = base.slice(dot + 1).toLowerCase()
  return IMAGE_MIME[ext] ?? null
}

/**
 * True when the buffer looks binary: a NUL in the first 8 KB (same heuristic
 * the file viewer has always used for non-image binaries).
 */
export function isBinaryBuffer(buffer: Uint8Array): boolean {
  return buffer.subarray(0, 8000).includes(0)
}

/** Git's unified-diff markers for a binary file (no usable text hunks). */
export function isGitBinaryDiff(raw: string): boolean {
  // `Binary files a/x and b/x differ` or a `GIT binary patch` section.
  return /\bBinary files\b/.test(raw) || raw.includes('GIT binary patch')
}
