import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readHtmlFile, resolveToolHtml } from './html-input'

describe('resolveToolHtml', () => {
  const dir = join(tmpdir(), 'porcelain-html-input-test')
  const file = join(dir, 'doc.html')

  beforeEach(() => {
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
    writeFileSync(file, '<h1>from file</h1>')
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns inline html', () => {
    expect(resolveToolHtml({ html: '<p>hi</p>' }, 1000)).toBe('<p>hi</p>')
  })

  it('reads htmlFile when provided', () => {
    expect(resolveToolHtml({ htmlFile: file }, 1000)).toBe('<h1>from file</h1>')
  })

  it('rejects both html and htmlFile', () => {
    expect(() => resolveToolHtml({ html: '<p>x</p>', htmlFile: file }, 1000)).toThrow('not both')
  })

  it('rejects when neither is provided', () => {
    expect(() => resolveToolHtml({}, 1000)).toThrow('html or htmlFile is required')
    expect(() => resolveToolHtml({ html: '' }, 1000)).toThrow('html or htmlFile is required')
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
    expect(() => readHtmlFile(join(dir, 'missing.html'), 1000)).toThrow('not readable')
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
