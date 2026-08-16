/**
 * Strict version-1 document-set manifest — shared by the daemon reader and the
 * dependency-free CLI writer. No Zod, no Node APIs: pure parse, serialize, and
 * the two derivations (medium, label) a document set needs.
 *
 * One primitive, two legacy migration inputs: Intent (`active-review/intent/`)
 * and the Results sub-tab of Evidence (`active-review/evidence/results/`). Both
 * are "drop files in a directory, pin the tab order in `meta.json`". New Review
 * Canvas state is daemon-root data; these paths remain for one-time conversion.
 */

export const DOC_SET_FILE_VERSION = 1 as const

/** At most this many tabs in one set — the writer caps, the reader caps. */
export const MAX_DOC_SET_TABS = 12

/** A tab strip is navigable only while its labels are short. */
export const MAX_DOC_SET_LABEL = 60

export type DocSetTab = {
  file: string
  label?: string
}

export type DocSetFileV1 = {
  version: typeof DOC_SET_FILE_VERSION
  tabs: DocSetTab[]
}

export type DocSetFileParseErrorCode = 'incompatible-version' | 'malformed'

export class DocSetFileParseError extends Error {
  readonly code: DocSetFileParseErrorCode

  constructor(code: DocSetFileParseErrorCode, message: string) {
    super(message)
    this.name = 'DocSetFileParseError'
    this.code = code
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * A file name and nothing else — no directory part, no traversal, no dotfile.
 * These names reach `readFile` in the daemon, so a manifest that names a path
 * is rejected here rather than filtered somewhere downstream.
 */
function isPlainFileName(name: string): boolean {
  return name !== '' && !name.includes('/') && !name.includes('\\') && !name.startsWith('.')
}

export function emptyDocSetFile(): DocSetFileV1 {
  return { version: DOC_SET_FILE_VERSION, tabs: [] }
}

function parseTab(value: unknown, index: number): DocSetTab {
  if (!isRecord(value)) {
    throw new DocSetFileParseError('malformed', `tabs[${index}] is not an object`)
  }
  for (const key of Object.keys(value)) {
    if (key !== 'file' && key !== 'label') {
      throw new DocSetFileParseError('malformed', `tabs[${index}] has unknown field ${key}`)
    }
  }
  if (typeof value.file !== 'string' || !isPlainFileName(value.file)) {
    throw new DocSetFileParseError('malformed', `tabs[${index}].file is not a plain file name`)
  }
  if (value.label === undefined) return { file: value.file }
  if (typeof value.label !== 'string' || value.label.length === 0) {
    throw new DocSetFileParseError('malformed', `tabs[${index}].label is not a non-empty string`)
  }
  if (value.label.length > MAX_DOC_SET_LABEL) {
    throw new DocSetFileParseError(
      'malformed',
      `tabs[${index}].label is ${value.label.length} chars, over the ${MAX_DOC_SET_LABEL}-char limit`,
    )
  }
  return { file: value.file, label: value.label }
}

/** Parse an untrusted manifest. Throws {@link DocSetFileParseError} on any violation. */
export function parseDocSetFile(value: unknown): DocSetFileV1 {
  if (Array.isArray(value)) {
    throw new DocSetFileParseError(
      'malformed',
      'Document-set manifest must be a version-1 object; top-level arrays are not supported',
    )
  }
  if (!isRecord(value)) {
    throw new DocSetFileParseError('malformed', 'Document-set manifest must be a JSON object')
  }
  for (const key of Object.keys(value)) {
    if (key !== 'version' && key !== 'tabs') {
      throw new DocSetFileParseError('malformed', `unknown field ${key}`)
    }
  }
  if (
    !('version' in value) ||
    typeof value.version !== 'number' ||
    !Number.isFinite(value.version)
  ) {
    throw new DocSetFileParseError('malformed', 'version is required')
  }
  if (value.version !== DOC_SET_FILE_VERSION) {
    throw new DocSetFileParseError(
      'incompatible-version',
      `unsupported document-set manifest version ${String(value.version)}`,
    )
  }
  if (!Array.isArray(value.tabs)) {
    throw new DocSetFileParseError('malformed', 'tabs must be an array')
  }

  const tabs: DocSetTab[] = []
  for (let index = 0; index < value.tabs.length && tabs.length < MAX_DOC_SET_TABS; index += 1) {
    tabs.push(parseTab(value.tabs[index], index))
  }
  return { version: DOC_SET_FILE_VERSION, tabs }
}

/** The bytes a writer puts on disk: capped, versioned, and readable by the daemon. */
export function serializeDocSetFile(tabs: readonly DocSetTab[]): string {
  const capped = tabs.slice(0, MAX_DOC_SET_TABS).map((tab) => ({ ...tab }))
  return JSON.stringify({ version: DOC_SET_FILE_VERSION, tabs: capped }, null, 2)
}

/**
 * The media a document set renders. Markdown renders escaped; HTML renders only
 * through a sandboxed `srcdoc`. A file with any other extension is not a tab.
 */
export const DOC_SET_MEDIUM_BY_EXT: Record<string, 'markdown' | 'html'> = {
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.html': 'html',
  '.htm': 'html',
}

/** Extension, lowercased, with no Node API: `''` for a name with no extension. */
function extensionOf(file: string): string {
  const dot = file.lastIndexOf('.')
  return dot <= 0 ? '' : file.slice(dot).toLowerCase()
}

export function docSetMediumFor(file: string): 'markdown' | 'html' | null {
  return DOC_SET_MEDIUM_BY_EXT[extensionOf(file)] ?? null
}

/** `why.md` → "Why"; `before-after.html` → "Before after"; never over the cap. */
export function docSetLabelFor(file: string): string {
  const dot = file.lastIndexOf('.')
  const base = (dot === -1 ? file : file.slice(0, dot)).replace(/[-_]+/g, ' ')
  const label = base.charAt(0).toUpperCase() + base.slice(1)
  return label.slice(0, MAX_DOC_SET_LABEL)
}
