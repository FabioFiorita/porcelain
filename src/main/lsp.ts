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
