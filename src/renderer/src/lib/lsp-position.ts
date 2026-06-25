import type { LspPosition } from '@main/lsp'

// Pure conversions between a flat string offset (a textarea `selectionStart`, or a
// caret offset from `caretPositionFromPoint`) and an LSP `{ line, character }`
// position. Both are 0-based and operate on JS string indices (UTF-16 code units),
// which is what the textarea and the LSP server agree on for ASCII/BMP source — we
// don't attempt UTF-8 byte or astral-plane remapping. Side-effect-free so they're
// unit-testable without a DOM.

/** Map a flat character `offset` into `content` to a 0-based LSP position. */
export function offsetToPosition(content: string, offset: number): LspPosition {
  const clamped = Math.max(0, Math.min(offset, content.length))
  let line = 0
  let lineStart = 0
  for (let i = 0; i < clamped; i++) {
    if (content.charCodeAt(i) === 10 /* \n */) {
      line++
      lineStart = i + 1
    }
  }
  return { line, character: clamped - lineStart }
}

/** Map a 0-based LSP position back to a flat character offset into `content`. */
export function positionToOffset(content: string, pos: LspPosition): number {
  let offset = 0
  let line = 0
  while (line < pos.line) {
    const next = content.indexOf('\n', offset)
    if (next === -1) return content.length // position past EOF clamps to the end
    offset = next + 1
    line++
  }
  // Don't let `character` spill onto the next line: clamp to this line's end.
  const lineEnd = content.indexOf('\n', offset)
  const max = lineEnd === -1 ? content.length : lineEnd
  return Math.min(offset + Math.max(0, pos.character), max)
}

// The only languages the TS language server understands. Gates every LSP code path
// alongside `lspEnabled` so a non-TS/JS file never triggers a doc-sync, query, or
// listener. Mirrors the extensions the highlighter maps to ts/tsx/js/jsx.
const LSP_EXTENSIONS = new Set(['ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs'])

/** True when `path` is a TypeScript/JavaScript file the language server can serve. */
export function isLspLang(path: string): boolean {
  const ext = path.split('.').at(-1)?.toLowerCase() ?? ''
  return LSP_EXTENSIONS.has(ext)
}
