// Symbol slicing for the feature reading surface: given an unchanged file
// (context/shipped) and the symbols the in-view files import from it, return only
// the line ranges that define those symbols — so the reader sees just the lines
// the feature actually uses, not the whole file. Heuristic and regex-based (no
// LSP, by design); it over/under-reaches on pathological code and is bounded by
// caps, with a graceful whole-file fallback when nothing is located. The diff
// half (changed files → hunks) needs none of this.

const MAX_SYMBOL_LINES = 80
const MAX_TOTAL_LINES = 400
const MERGE_GAP = 2
const FALLBACK_LINES = 200

export interface ImportBinding {
  spec: string
  /** Imported (original) names — `'*'` for a namespace/`export *`, `'default'` for a default import. */
  names: string[]
}

export interface SliceRange {
  /** 1-based line number where this range starts in the original file. */
  startLine: number
  /** The source lines of this range (inclusive). */
  lines: string[]
  /** Count of lines elided immediately before this range (0 for the first). */
  gapBefore: number
}

export interface FileSlice {
  ranges: SliceRange[]
  /** True when the slice was capped — more relevant lines exist than are shown. */
  truncated: boolean
  /** True when no specific symbol was located and we fell back to the whole file. */
  whole: boolean
}

function bindingNames(clause: string): string[] {
  const names = new Set<string>()
  // `* as ns` (namespace import) or `export * from` — we can't know which symbols,
  // so flag everything with '*'.
  if (clause.includes('*')) names.add('*')
  const brace = clause.match(/\{([\s\S]*?)\}/)
  if (brace?.[1]) {
    for (const part of brace[1].split(',')) {
      const cleaned = part.trim().replace(/^type\s+/, '')
      const name = cleaned.split(/\s+as\s+/)[0]?.trim()
      if (name && /^\w+$/.test(name)) names.add(name)
    }
  }
  // A leading identifier before the brace is a default import.
  if (!clause.includes('*')) {
    const before = clause.split('{')[0]?.trim() ?? ''
    if (/^\w/.test(before)) names.add('default')
  }
  return [...names]
}

/**
 * Parse `import … from` / `export … from` statements, capturing WHICH symbols each
 * pulls from its module specifier. Side-effect imports, dynamic `import()`, and
 * `require()` carry no static named bindings and are ignored here (they're handled
 * for connect-edges by `parseImports`).
 */
export function parseImportBindings(source: string): ImportBinding[] {
  const bindings: ImportBinding[] = []
  // The clause (between import/export and `from`) never contains a quote, so
  // `[^'"]` keeps each match inside one statement — a preceding side-effect
  // `import './x'` can't be lazily swallowed to reach the next `from`.
  const re = /(?:^|\n)\s*(?:import|export)\b([^'"]*?)\bfrom\s*['"]([^'"]+)['"]/g
  for (const m of source.matchAll(re)) {
    const spec = m[2]
    if (spec) bindings.push({ spec, names: bindingNames(m[1] ?? '') })
  }
  return bindings
}

/**
 * The union of symbol names the in-view files import from `targetPath`. `resolve`
 * maps an import specifier (relative or aliased) to an in-view file path. A `'*'`
 * in the result means a caller pulled the whole namespace, so the slice should
 * fall back to all exports.
 */
export function collectImportedSymbols(
  targetPath: string,
  sources: ReadonlyMap<string, string>,
  resolve: (spec: string, importerPath: string) => string | null,
): Set<string> {
  const symbols = new Set<string>()
  for (const [importerPath, source] of sources) {
    if (importerPath === targetPath) continue
    for (const { spec, names } of parseImportBindings(source)) {
      if (resolve(spec, importerPath) === targetPath) for (const n of names) symbols.add(n)
    }
  }
  return symbols
}

// A top-level export declaration and the symbol name it defines. Top-level = the
// `export` keyword at column 0 (nested/inner exports are indented).
const DECL_PATTERNS: { re: RegExp; defaultName?: string }[] = [
  { re: /^export\s+default\b/, defaultName: 'default' },
  { re: /^export\s+(?:async\s+)?function\*?\s+(\w+)/ },
  { re: /^export\s+(?:abstract\s+)?class\s+(\w+)/ },
  { re: /^export\s+(?:const|let|var)\s+(\w+)/ },
  { re: /^export\s+(?:type|interface|enum)\s+(\w+)/ },
  { re: /^export\s*\{/ }, // single-line re-export / export list — name(s) on the line
]

function declNameAt(line: string): string | null | undefined {
  for (const { re, defaultName } of DECL_PATTERNS) {
    const m = line.match(re)
    if (m) return defaultName ?? m[1] ?? null
  }
  return undefined // not a top-level export declaration
}

// Walk upward over the doc comment / decorators directly attached to a declaration.
function spanStart(lines: string[], decl: number): number {
  let start = decl
  for (let i = decl - 1; i >= 0; i--) {
    const t = lines[i]?.trim() ?? ''
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('@')) {
      start = i
    } else if (t === '') {
      break
    } else {
      break
    }
  }
  return start
}

// Extend a declaration to the end of its statement by tracking bracket depth, with
// a continuation check for brace-less multi-line forms (type unions, etc.). Brackets
// inside strings/comments can skew the count — the per-symbol cap bounds the damage.
function spanEnd(lines: string[], decl: number): number {
  let depth = 0
  for (let j = decl; j < lines.length && j < decl + MAX_SYMBOL_LINES; j++) {
    for (const ch of lines[j] ?? '') {
      if (ch === '{' || ch === '(' || ch === '[') depth++
      else if (ch === '}' || ch === ')' || ch === ']') depth--
    }
    const trimmed = (lines[j] ?? '').trimEnd()
    const continues = /[=|&,(<+]$/.test(trimmed) || /\b(extends|implements)$/.test(trimmed)
    if (depth <= 0 && !continues) return j
  }
  return Math.min(decl + MAX_SYMBOL_LINES - 1, lines.length - 1)
}

interface Span {
  start: number
  end: number
}

function mergeSpans(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start)
  const merged: Span[] = []
  for (const span of sorted) {
    const last = merged.at(-1)
    if (last && span.start <= last.end + 1 + MERGE_GAP) {
      last.end = Math.max(last.end, span.end)
    } else {
      merged.push({ ...span })
    }
  }
  return merged
}

/**
 * Slice `source` to the definitions of `symbols`. A `'*'` or an empty set means
 * "all exports" (a namespace import, or a cross-seam file the import graph can't
 * pin to specific names). Falls back to the whole file (capped) when nothing is
 * located, so the reader always sees something.
 */
export function sliceSource(source: string, symbols: ReadonlySet<string>): FileSlice {
  const lines = source.split('\n')
  if (lines.at(-1) === '') lines.pop()
  const allExports = symbols.size === 0 || symbols.has('*')

  const spans: Span[] = []
  for (let i = 0; i < lines.length; i++) {
    const name = declNameAt(lines[i] ?? '')
    if (name === undefined) continue // not an export
    if (!allExports && name !== null && !symbols.has(name)) continue
    spans.push({ start: spanStart(lines, i), end: spanEnd(lines, i) })
  }

  if (spans.length === 0) {
    const end = Math.min(lines.length, FALLBACK_LINES)
    return {
      ranges: [{ startLine: 1, lines: lines.slice(0, end), gapBefore: 0 }],
      truncated: lines.length > FALLBACK_LINES,
      whole: true,
    }
  }

  const merged = mergeSpans(spans)
  const ranges: SliceRange[] = []
  let total = 0
  let truncated = false
  let prevEnd = -1
  for (const span of merged) {
    const len = span.end - span.start + 1
    if (total + len > MAX_TOTAL_LINES) {
      truncated = true
      break
    }
    ranges.push({
      startLine: span.start + 1,
      lines: lines.slice(span.start, span.end + 1),
      gapBefore: prevEnd === -1 ? span.start : span.start - prevEnd - 1,
    })
    total += len
    prevEnd = span.end
  }

  return { ranges, truncated, whole: false }
}
