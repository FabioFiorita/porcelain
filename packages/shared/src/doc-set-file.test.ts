import { describe, expect, it } from 'vitest'
import {
  DOC_SET_FILE_VERSION,
  DocSetFileParseError,
  docSetLabelFor,
  docSetMediumFor,
  emptyDocSetFile,
  MAX_DOC_SET_LABEL,
  MAX_DOC_SET_TABS,
  parseDocSetFile,
  serializeDocSetFile,
} from './doc-set-file'

/** The code an invalid document reports, or `null` when it parsed. */
const codeOf = (value: unknown): string | null => {
  try {
    parseDocSetFile(value)
    return null
  } catch (error) {
    return error instanceof DocSetFileParseError ? error.code : 'not-a-parse-error'
  }
}

describe('doc-set manifest round trip', () => {
  it('serializes what it parses, version and all', () => {
    const tabs = [{ file: 'why.md', label: 'Why' }, { file: 'approach.md' }]
    const raw = serializeDocSetFile(tabs)
    expect(JSON.parse(raw)).toEqual({ version: DOC_SET_FILE_VERSION, tabs })
    expect(parseDocSetFile(JSON.parse(raw))).toEqual({ version: 1, tabs })
  })

  it('starts empty and parses its own empty document', () => {
    expect(emptyDocSetFile()).toEqual({ version: 1, tabs: [] })
    expect(parseDocSetFile(emptyDocSetFile())).toEqual({ version: 1, tabs: [] })
  })

  // The cap is the writer's AND the reader's: a 13th tab an older writer left on
  // disk must not push the reader past the ceiling it renders.
  it('drops the thirteenth tab on write and on read', () => {
    const tabs = Array.from({ length: MAX_DOC_SET_TABS + 1 }, (_, i) => ({ file: `${i}.md` }))
    expect(JSON.parse(serializeDocSetFile(tabs)).tabs).toHaveLength(MAX_DOC_SET_TABS)
    expect(parseDocSetFile({ version: 1, tabs }).tabs).toHaveLength(MAX_DOC_SET_TABS)
  })
})

describe('doc-set label cap', () => {
  // The drift this module exists to end: an over-long label made the daemon drop
  // the WHOLE manifest and fall back to name order, silently.
  it('rejects a label over the cap on parse', () => {
    const label = 'x'.repeat(MAX_DOC_SET_LABEL + 1)
    expect(codeOf({ version: 1, tabs: [{ file: 'a.md', label }] })).toBe('malformed')
    expect(codeOf({ version: 1, tabs: [{ file: 'a.md', label: label.slice(1) }] })).toBeNull()
  })

  it('truncates a derived label to the cap instead', () => {
    const file = `${'a'.repeat(200)}.md`
    expect(docSetLabelFor(file)).toHaveLength(MAX_DOC_SET_LABEL)
    expect(codeOf({ version: 1, tabs: [{ file, label: docSetLabelFor(file) }] })).toBeNull()
  })

  it('derives the label from the name', () => {
    expect(docSetLabelFor('why.md')).toBe('Why')
    expect(docSetLabelFor('before-after.html')).toBe('Before after')
    expect(docSetLabelFor('run_log.markdown')).toBe('Run log')
  })
})

describe('doc-set manifest rejections', () => {
  it('reports an incompatible version separately from a malformed document', () => {
    expect(codeOf({ version: 2, tabs: [] })).toBe('incompatible-version')
    expect(codeOf([{ file: 'a.md' }])).toBe('malformed')
    expect(codeOf({ tabs: [] })).toBe('malformed')
    expect(codeOf({ version: Number.POSITIVE_INFINITY, tabs: [] })).toBe('malformed')
    expect(codeOf({ version: 1, tabs: [], extra: true })).toBe('malformed')
    expect(codeOf({ version: 1 })).toBe('malformed')
  })

  // These names reach `readFile` in the daemon.
  it('refuses a file name that is a path, a dotfile, or empty', () => {
    expect(codeOf({ version: 1, tabs: [{ file: '../../etc/passwd' }] })).toBe('malformed')
    expect(codeOf({ version: 1, tabs: [{ file: 'nested\\a.md' }] })).toBe('malformed')
    expect(codeOf({ version: 1, tabs: [{ file: '.hidden.md' }] })).toBe('malformed')
    expect(codeOf({ version: 1, tabs: [{ file: '' }] })).toBe('malformed')
  })

  it('refuses an unknown field inside a tab', () => {
    expect(codeOf({ version: 1, tabs: [{ file: 'a.md', medium: 'html' }] })).toBe('malformed')
  })
})

describe('doc-set media', () => {
  it('renders exactly the four document extensions', () => {
    expect(docSetMediumFor('why.md')).toBe('markdown')
    expect(docSetMediumFor('why.MARKDOWN')).toBe('markdown')
    expect(docSetMediumFor('report.html')).toBe('html')
    expect(docSetMediumFor('report.htm')).toBe('html')
    expect(docSetMediumFor('notes.txt')).toBeNull()
    expect(docSetMediumFor('board.excalidraw')).toBeNull()
    expect(docSetMediumFor('README')).toBeNull()
  })
})
