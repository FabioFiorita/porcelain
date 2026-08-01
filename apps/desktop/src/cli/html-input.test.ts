import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readHtmlFile, resolveToolHtml } from './html-input'

// A plausible self-contained document: has a `<` tag and clears the MIN_HTML_BYTES floor.
const doc = `<main>${'x'.repeat(600)}</main>`

describe('resolveToolHtml', () => {
  const dir = join(tmpdir(), 'porcelain-html-input-test')
  const file = join(dir, 'doc.html')

  beforeEach(() => {
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
    writeFileSync(file, doc)
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns inline html', () => {
    expect(resolveToolHtml({ html: doc }, 100_000)).toBe(doc)
  })

  it('reads htmlFile when provided', () => {
    expect(resolveToolHtml({ htmlFile: file }, 100_000)).toBe(doc)
  })

  it('rejects both html and htmlFile', () => {
    expect(() => resolveToolHtml({ html: doc, htmlFile: file }, 100_000)).toThrow('not both')
  })

  it('rejects when neither is provided', () => {
    expect(() => resolveToolHtml({}, 1000)).toThrow('--html or --html-file is required')
    expect(() => resolveToolHtml({ html: '' }, 1000)).toThrow('--html or --html-file is required')
  })

  it('rejects a file path pasted into the html field, pointing at --html-file', () => {
    expect(() => resolveToolHtml({ html: 'filePath:/tmp/x/loop-evidence.html' }, 100_000)).toThrow(
      /html-file/,
    )
  })

  it('rejects an implausibly small html document, pointing at --html-file', () => {
    expect(() => resolveToolHtml({ html: '<p>tiny</p>' }, 100_000)).toThrow(/too small/)
    expect(() => resolveToolHtml({ html: '<p>tiny</p>' }, 100_000)).toThrow(/html-file/)
  })
})

describe('readHtmlFile', () => {
  const dir = join(tmpdir(), 'porcelain-html-input-read-test')
  const file = join(dir, 'doc.html')

  beforeEach(() => {
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('rejects a relative path', () => {
    expect(() => readHtmlFile('relative.html', 1000)).toThrow('absolute path')
  })

  it('rejects a missing file', () => {
    expect(() => readHtmlFile(join(dir, 'missing.html'), 1000)).toThrow('not found or unreadable')
  })

  it('rejects an empty file', () => {
    writeFileSync(file, '')
    expect(() => readHtmlFile(file, 1000)).toThrow('empty')
  })

  it('rejects a file over the byte cap without reading past the cap intent', () => {
    writeFileSync(file, 'x'.repeat(50))
    expect(() => readHtmlFile(file, 10)).toThrow('over the')
  })

  it('returns the file contents under the cap', () => {
    writeFileSync(file, '<p>ok</p>')
    expect(readHtmlFile(file, 1000)).toBe('<p>ok</p>')
  })
})
