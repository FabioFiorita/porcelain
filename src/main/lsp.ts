import { fileURLToPath } from 'node:url'

// The pure half of the TS-language-server integration: JSON-RPC stdio framing and
// the converters from LSP wire shapes to the app's internal types. Side-effect-free
// and dependency-light (one Node builtin), so every branch is unit-testable without
// spawning a server. The impure lifecycle (spawn, request correlation, diagnostics
// cache) lives in `lsp-manager.ts`; it leans on these helpers.

// 0-based, matching LSP. The renderer speaks the same coordinates.
export interface LspPosition {
  line: number
  character: number
}

export interface HoverInfo {
  markdown: string
}

// 0-based ranges; `path` is an absolute fs path (the wire `file://` uri decoded).
export interface SymbolLocation {
  path: string
  line: number
  character: number
  endLine: number
  endCharacter: number
}

export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint'

export interface Diagnostic {
  line: number
  character: number
  endLine: number
  endCharacter: number
  severity: DiagnosticSeverity
  message: string
  source?: string
}

// --- JSON-RPC stdio framing -------------------------------------------------

// Frame a message with the LSP `Content-Length` header. The length is the BYTE
// count of the UTF-8 body, not its character count — a multibyte body would
// otherwise under-report and desync the peer's decoder.
export function encodeMessage(msg: object): string {
  const body = JSON.stringify(msg)
  const length = Buffer.byteLength(body, 'utf8')
  return `Content-Length: ${length}\r\n\r\n${body}`
}

// A streaming decoder for the framed stream. `push` accumulates raw chunk bytes
// and returns every complete message that the buffer now holds — correctly
// handling a header split across chunks, a body split across chunks, and several
// messages packed into one chunk. Accumulates as a Buffer (not a string) because
// `Content-Length` is a byte count: slicing by characters would corrupt any body
// containing multibyte text.
export interface MessageBuffer {
  push(chunk: string | Buffer): object[]
}

export function createMessageBuffer(): MessageBuffer {
  let buffer = Buffer.alloc(0)

  return {
    push(chunk: string | Buffer): object[] {
      buffer = Buffer.concat([
        buffer,
        typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk,
      ])
      const messages: object[] = []

      while (true) {
        const headerEnd = buffer.indexOf('\r\n\r\n')
        if (headerEnd === -1) break // header not fully arrived yet
        const header = buffer.subarray(0, headerEnd).toString('utf8')
        const match = /content-length:\s*(\d+)/i.exec(header)
        if (!match) {
          // A header block with no Content-Length is unframeable garbage; drop it
          // and resync past the separator rather than spinning on it forever.
          buffer = buffer.subarray(headerEnd + 4)
          continue
        }
        const length = Number(match[1])
        const bodyStart = headerEnd + 4
        if (buffer.length - bodyStart < length) break // body not fully arrived yet
        const body = buffer.subarray(bodyStart, bodyStart + length).toString('utf8')
        buffer = buffer.subarray(bodyStart + length)
        try {
          messages.push(JSON.parse(body) as object)
        } catch {
          // A malformed body shouldn't wedge the stream — we've already advanced
          // past it, so just skip it and keep decoding the rest.
        }
      }
      return messages
    },
  }
}

// --- LSP wire-shape converters ----------------------------------------------

// LSP `MarkedString` = a plain string, or `{ language, value }` (a fenced code
// block). `MarkupContent` = `{ kind, value }`. `Hover.contents` is any of those,
// or an array of MarkedString. We flatten all of it to one markdown string.
type MarkupContent = { kind: string; value: string }
type MarkedString = string | { language: string; value: string }
type LspHover = { contents?: MarkupContent | MarkedString | MarkedString[] } | null | undefined

function isMarkupContent(value: unknown): value is MarkupContent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    'value' in value &&
    typeof (value as MarkupContent).value === 'string'
  )
}

function markedStringToMarkdown(value: MarkedString): string {
  if (typeof value === 'string') return value
  // A `{ language, value }` marked string renders as a fenced code block.
  return `\`\`\`${value.language}\n${value.value}\n\`\`\``
}

export function toHoverInfo(lspHover: LspHover): HoverInfo | null {
  const contents = lspHover?.contents
  if (contents === undefined || contents === null) return null

  let markdown: string
  if (isMarkupContent(contents)) {
    markdown = contents.value
  } else if (Array.isArray(contents)) {
    markdown = contents.map(markedStringToMarkdown).join('\n')
  } else {
    markdown = markedStringToMarkdown(contents)
  }

  markdown = markdown.trim()
  return markdown === '' ? null : { markdown }
}

// `textDocument/definition` (and references) returns `Location`, `Location[]`, or
// `LocationLink[]`. A `Location` has `uri`+`range`; a `LocationLink` has
// `targetUri`+`targetSelectionRange` (preferred) / `targetRange`. We normalize all
// three to `SymbolLocation[]` with fs paths (file:// uris decoded).
type LspRange = {
  start: { line: number; character: number }
  end: { line: number; character: number }
}
type Location = { uri: string; range: LspRange }
type LocationLink = {
  targetUri: string
  targetSelectionRange?: LspRange
  targetRange: LspRange
}
type LspDefinitionResult =
  | Location
  | LocationLink
  | Array<Location | LocationLink>
  | null
  | undefined

function isLocationLink(value: Location | LocationLink): value is LocationLink {
  return 'targetUri' in value
}

function uriToPath(uri: string): string | null {
  try {
    return fileURLToPath(uri)
  } catch {
    // A non-file uri (untitled:, etc.) has no fs path — drop it from the results.
    return null
  }
}

function locationToSymbol(value: Location | LocationLink): SymbolLocation | null {
  const uri = isLocationLink(value) ? value.targetUri : value.uri
  const range = isLocationLink(value)
    ? (value.targetSelectionRange ?? value.targetRange)
    : value.range
  const path = uriToPath(uri)
  if (path === null) return null
  return {
    path,
    line: range.start.line,
    character: range.start.character,
    endLine: range.end.line,
    endCharacter: range.end.character,
  }
}

export function toSymbolLocations(result: LspDefinitionResult): SymbolLocation[] {
  if (result === null || result === undefined) return []
  const items = Array.isArray(result) ? result : [result]
  return items
    .map(locationToSymbol)
    .filter((location): location is SymbolLocation => location !== null)
}

// LSP diagnostic severity is 1..4 (Error/Warning/Information/Hint). Anything else
// (or absent) we treat as an error — the loudest, safest default.
const SEVERITY_BY_CODE: Record<number, DiagnosticSeverity> = {
  1: 'error',
  2: 'warning',
  3: 'info',
  4: 'hint',
}

type LspDiagnostic = {
  range: LspRange
  severity?: number
  message: string
  source?: string
}

export function toDiagnostics(lspDiagnostics: LspDiagnostic[] | null | undefined): Diagnostic[] {
  if (!lspDiagnostics) return []
  return lspDiagnostics.map((diagnostic) => ({
    line: diagnostic.range.start.line,
    character: diagnostic.range.start.character,
    endLine: diagnostic.range.end.line,
    endCharacter: diagnostic.range.end.character,
    severity:
      (diagnostic.severity !== undefined && SEVERITY_BY_CODE[diagnostic.severity]) || 'error',
    message: diagnostic.message,
    source: diagnostic.source,
  }))
}

// --- Completion -------------------------------------------------------------

// LSP `CompletionItemKind` is 1..25. We map each to a short string the renderer
// shows as a glyph; anything unmapped (or absent) falls back to 'text', mirroring
// the SEVERITY_BY_CODE shape for diagnostics.
export type CompletionKind =
  | 'text'
  | 'method'
  | 'function'
  | 'constructor'
  | 'field'
  | 'variable'
  | 'class'
  | 'interface'
  | 'module'
  | 'property'
  | 'unit'
  | 'value'
  | 'enum'
  | 'keyword'
  | 'snippet'
  | 'color'
  | 'file'
  | 'reference'
  | 'folder'
  | 'enummember'
  | 'constant'
  | 'struct'
  | 'event'
  | 'operator'
  | 'typeparameter'

const KIND_BY_CODE: Record<number, CompletionKind> = {
  1: 'text',
  2: 'method',
  3: 'function',
  4: 'constructor',
  5: 'field',
  6: 'variable',
  7: 'class',
  8: 'interface',
  9: 'module',
  10: 'property',
  11: 'unit',
  12: 'value',
  13: 'enum',
  14: 'keyword',
  15: 'snippet',
  16: 'color',
  17: 'file',
  18: 'reference',
  19: 'folder',
  20: 'enummember',
  21: 'constant',
  22: 'struct',
  23: 'event',
  24: 'operator',
  25: 'typeparameter',
}

export interface CompletionItem {
  label: string
  kind: CompletionKind
  detail?: string
  documentation?: string
  insertText?: string
  sortText?: string
  filterText?: string
  // The 0-based range the accepted item should replace (from an InsertReplaceEdit's
  // `replace`, or a plain TextEdit's `range`). Absent when the server gave none.
  replace?: { line: number; character: number; endLine: number; endCharacter: number }
  // The text to splice in over `replace` (the edit's `newText`), distinct from
  // `insertText` (used when there's no explicit range).
  newText?: string
}

type LspTextEdit = { range: LspRange; newText: string }
// `InsertReplaceEdit` carries two ranges; we always prefer `replace` (overtype).
type LspInsertReplaceEdit = { insert: LspRange; replace: LspRange; newText: string }
type LspCompletionItem = {
  label?: string
  kind?: number
  detail?: string
  documentation?: string | MarkupContent
  insertText?: string
  sortText?: string
  filterText?: string
  textEdit?: LspTextEdit | LspInsertReplaceEdit
}
type LspCompletionResult =
  | LspCompletionItem[]
  | { isIncomplete?: boolean; items: LspCompletionItem[] }
  | null
  | undefined

function isInsertReplaceEdit(
  edit: LspTextEdit | LspInsertReplaceEdit,
): edit is LspInsertReplaceEdit {
  return 'replace' in edit
}

// `documentation` is a plain string or `{ kind, value }` MarkupContent; flatten to
// the string, reusing the same MarkupContent guard the hover path uses.
function flattenDocumentation(doc: string | MarkupContent | undefined): string | undefined {
  if (doc === undefined) return undefined
  if (typeof doc === 'string') return doc
  return isMarkupContent(doc) ? doc.value : undefined
}

export function toCompletionItems(result: LspCompletionResult): CompletionItem[] {
  if (result === null || result === undefined) return []
  const items = Array.isArray(result) ? result : result.items
  if (!items) return []
  const out: CompletionItem[] = []
  for (const item of items) {
    if (item.label === undefined) continue // a label-less item is unrenderable
    const edit = item.textEdit
    const range = edit ? (isInsertReplaceEdit(edit) ? edit.replace : edit.range) : undefined
    out.push({
      label: item.label,
      kind: (item.kind !== undefined && KIND_BY_CODE[item.kind]) || 'text',
      detail: item.detail,
      documentation: flattenDocumentation(item.documentation),
      insertText: item.insertText,
      sortText: item.sortText,
      filterText: item.filterText,
      replace: range
        ? {
            line: range.start.line,
            character: range.start.character,
            endLine: range.end.line,
            endCharacter: range.end.character,
          }
        : undefined,
      newText: edit ? edit.newText : undefined,
    })
  }
  return out
}

// --- Text edits / formatting / rename ---------------------------------------

// A 0-based replace range plus its replacement text. The flat shape the renderer
// and `applyTextEdits` both speak (matching SymbolLocation's flattened range).
export interface TextEdit {
  line: number
  character: number
  endLine: number
  endCharacter: number
  newText: string
}

// `textDocument/formatting` (and rangeFormatting) returns `TextEdit[] | null`.
export function toTextEdits(result: LspTextEdit[] | null | undefined): TextEdit[] {
  if (!result) return []
  return result.map((edit) => ({
    line: edit.range.start.line,
    character: edit.range.start.character,
    endLine: edit.range.end.line,
    endCharacter: edit.range.end.character,
    newText: edit.newText,
  }))
}

// The range to rename plus a `placeholder` the renderer seeds the input with. An
// empty placeholder means "derive it from the source text under the range".
export interface RenamePrep {
  line: number
  character: number
  endLine: number
  endCharacter: number
  placeholder: string
}

type LspPrepareRenameResult =
  | LspRange
  | { range: LspRange; placeholder: string }
  | { defaultBehavior: boolean }
  | null
  | undefined

function isPlaceholderRange(
  value: LspRange | { range: LspRange; placeholder: string },
): value is { range: LspRange; placeholder: string } {
  return 'range' in value
}

// `textDocument/prepareRename` returns null (not renamable), a bare Range, a
// `{ range, placeholder }`, or `{ defaultBehavior }`. `defaultBehavior: false`
// means "not renamable" → null; a bare Range or `defaultBehavior: true` carry no
// placeholder, so we hand back '' and let the renderer derive one from the source.
export function toRenamePrep(result: LspPrepareRenameResult): RenamePrep | null {
  if (result === null || result === undefined) return null
  if ('defaultBehavior' in result) return null // bare defaultBehavior carries no range
  const range = isPlaceholderRange(result) ? result.range : result
  const placeholder = isPlaceholderRange(result) ? result.placeholder : ''
  return {
    line: range.start.line,
    character: range.start.character,
    endLine: range.end.line,
    endCharacter: range.end.character,
    placeholder,
  }
}

// One file's worth of edits from a `WorkspaceEdit`. `path` is an ABSOLUTE fs path
// (the file:// uri decoded), so `applyWorkspaceEdit` can read/write it directly.
export interface FileEdits {
  path: string
  edits: TextEdit[]
}

type LspWorkspaceEdit = {
  changes?: Record<string, LspTextEdit[]>
  documentChanges?: Array<{ textDocument?: { uri?: string }; edits?: LspTextEdit[] }>
}

// `textDocument/rename` returns a WorkspaceEdit with EITHER `changes` (uri→edits)
// or `documentChanges` (versioned, ordered). We normalize both, decoding each
// file:// uri to an abs path and dropping non-file uris and non-text resource ops
// (create/rename/delete entries lack `edits` and so fall out naturally).
export function toWorkspaceEdit(result: LspWorkspaceEdit | null | undefined): FileEdits[] {
  if (!result) return []
  const out: FileEdits[] = []
  if (result.changes) {
    for (const [uri, edits] of Object.entries(result.changes)) {
      const path = uriToPath(uri)
      if (path === null) continue
      out.push({ path, edits: toTextEdits(edits) })
    }
  }
  if (result.documentChanges) {
    for (const change of result.documentChanges) {
      const uri = change.textDocument?.uri
      if (uri === undefined || !change.edits) continue // a resource op (no edits) → skip
      const path = uriToPath(uri)
      if (path === null) continue
      out.push({ path, edits: toTextEdits(change.edits) })
    }
  }
  return out
}

// Flatten a 0-based `{ line, character }` to a string offset, counting newlines
// ourselves so this stays a pure function (the same logic as positionToOffset in
// the renderer, kept local so lsp.ts has no DOM/renderer dependency).
function flatOffset(content: string, line: number, character: number): number {
  let offset = 0
  let currentLine = 0
  while (currentLine < line) {
    const next = content.indexOf('\n', offset)
    if (next === -1) return content.length // past EOF clamps to the end
    offset = next + 1
    currentLine++
  }
  const lineEnd = content.indexOf('\n', offset)
  const max = lineEnd === -1 ? content.length : lineEnd
  return Math.min(offset + Math.max(0, character), max)
}

// Apply a set of TextEdits to `content`, returning the new text. PURE: we convert
// every edit's start/end to flat offsets, sort DESCENDING by start offset, then
// splice from the end backward — so an earlier splice never shifts the offsets of
// a later (lower) one. Ties on start are broken by end so a zero-width insert and
// an overlapping replace at the same point keep a stable order.
export function applyTextEdits(content: string, edits: TextEdit[]): string {
  const resolved = edits
    .map((edit) => ({
      start: flatOffset(content, edit.line, edit.character),
      end: flatOffset(content, edit.endLine, edit.endCharacter),
      newText: edit.newText,
    }))
    .sort((a, b) => b.start - a.start || b.end - a.end)
  let result = content
  for (const edit of resolved) {
    result = result.slice(0, edit.start) + edit.newText + result.slice(edit.end)
  }
  return result
}
