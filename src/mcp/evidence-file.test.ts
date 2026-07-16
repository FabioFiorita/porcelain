import { existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearEvidence,
  describeEvidence,
  getEvidence,
  MAX_HTML_BYTES,
  setEvidence,
  validateEvidence,
} from './evidence-file'

describe('validateEvidence', () => {
  it('accepts a non-empty title + html', () => {
    expect(validateEvidence('Title', '<p>hi</p>')).toEqual({ title: 'Title', html: '<p>hi</p>' })
  })

  it('throws on an empty or non-string title', () => {
    expect(() => validateEvidence('', '<p>hi</p>')).toThrow('title must be a non-empty string')
    expect(() => validateEvidence('   ', '<p>hi</p>')).toThrow('title must be a non-empty string')
    expect(() => validateEvidence(42, '<p>hi</p>')).toThrow('title must be a non-empty string')
  })

  it('throws on an empty or non-string html', () => {
    expect(() => validateEvidence('Title', '')).toThrow('html must be a non-empty string')
    expect(() => validateEvidence('Title', 123)).toThrow('html must be a non-empty string')
  })

  it('throws when the html exceeds the size cap', () => {
    const tooBig = 'x'.repeat(MAX_HTML_BYTES + 1)
    expect(() => validateEvidence('Title', tooBig)).toThrow('over the')
  })

  it('accepts html right at the cap', () => {
    const atCap = 'x'.repeat(MAX_HTML_BYTES)
    expect(() => validateEvidence('Title', atCap)).not.toThrow()
  })
})

describe('evidence round-trip', () => {
  const dir = join(tmpdir(), 'porcelain-evidence-test')
  const file = join(dir, 'evidence.json')

  beforeEach(() => {
    process.env.PORCELAIN_EVIDENCE = file
    rmSync(dir, { recursive: true, force: true })
  })
  afterEach(() => {
    delete process.env.PORCELAIN_EVIDENCE
    rmSync(dir, { recursive: true, force: true })
  })

  const read = (): Record<string, { title: string; html: string; updatedAt: string }> =>
    JSON.parse(readFileSync(file, 'utf8'))

  it('setEvidence writes a repo-keyed evidence with a timestamp', () => {
    const evidence = setEvidence('/repo', 'Vite loop', '<h1>Pass</h1>')
    expect(evidence.title).toBe('Vite loop')
    expect(evidence.updatedAt).not.toBe('')
    expect(read()['/repo']).toEqual({
      title: 'Vite loop',
      html: '<h1>Pass</h1>',
      updatedAt: evidence.updatedAt,
    })
  })

  it('setEvidence replaces an existing evidence for the repo', () => {
    setEvidence('/repo', 'First', '<p>1</p>')
    setEvidence('/repo', 'Second', '<p>2</p>')
    expect(getEvidence('/repo')?.title).toBe('Second')
    expect(getEvidence('/repo')?.html).toBe('<p>2</p>')
  })

  it('setEvidence validates before writing', () => {
    expect(() => setEvidence('/repo', '', '<p>x</p>')).toThrow('title must be a non-empty string')
    expect(existsSync(file)).toBe(false)
  })

  it('getEvidence returns the stored evidence, or null when none exists', () => {
    expect(getEvidence('/repo')).toBeNull()
    setEvidence('/repo', 'Vite loop', '<h1>Pass</h1>')
    expect(getEvidence('/repo')?.title).toBe('Vite loop')
  })

  it('clearEvidence removes only the target repo', () => {
    setEvidence('/repo', 'x', '<p>x</p>')
    setEvidence('/other', 'y', '<p>y</p>')
    clearEvidence('/repo')
    const all = read()
    expect(all['/repo']).toBeUndefined()
    expect(all['/other']).toBeDefined()
    expect(existsSync(file)).toBe(true)
  })

  it('clearEvidence is a no-op when the repo has no evidence', () => {
    setEvidence('/other', 'y', '<p>y</p>')
    clearEvidence('/repo')
    expect(read()['/other']).toBeDefined()
  })
})

describe('describeEvidence', () => {
  it('explains there is none when absent', () => {
    expect(describeEvidence('/repo', null)).toContain('No loop evidence for /repo')
  })

  it('summarizes the evidence without echoing the whole document', () => {
    const text = describeEvidence('/repo', {
      title: 'Vite loop',
      html: '<h1>Pass</h1>',
      updatedAt: '2026-07-04T00:00:00.000Z',
    })
    expect(text).toContain('Loop evidence "Vite loop" for /repo')
    expect(text).toContain('bytes of HTML')
    expect(text).not.toContain('<h1>')
  })
})
