import { existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearArtifact,
  describeArtifact,
  getArtifact,
  MAX_HTML_BYTES,
  setArtifact,
  validateArtifact,
} from './artifact-file'

describe('validateArtifact', () => {
  it('accepts a non-empty title + html', () => {
    expect(validateArtifact('Title', '<p>hi</p>')).toEqual({ title: 'Title', html: '<p>hi</p>' })
  })

  it('throws on an empty or non-string title', () => {
    expect(() => validateArtifact('', '<p>hi</p>')).toThrow('title must be a non-empty string')
    expect(() => validateArtifact('   ', '<p>hi</p>')).toThrow('title must be a non-empty string')
    expect(() => validateArtifact(42, '<p>hi</p>')).toThrow('title must be a non-empty string')
  })

  it('throws on an empty or non-string html', () => {
    expect(() => validateArtifact('Title', '')).toThrow('html must be a non-empty string')
    expect(() => validateArtifact('Title', 123)).toThrow('html must be a non-empty string')
  })

  it('throws when the html exceeds the size cap', () => {
    const tooBig = 'x'.repeat(MAX_HTML_BYTES + 1)
    expect(() => validateArtifact('Title', tooBig)).toThrow('over the')
  })

  it('accepts html right at the cap', () => {
    const atCap = 'x'.repeat(MAX_HTML_BYTES)
    expect(() => validateArtifact('Title', atCap)).not.toThrow()
  })
})

describe('artifact round-trip', () => {
  const dir = join(tmpdir(), 'porcelain-artifact-test')
  const file = join(dir, 'artifacts.json')

  beforeEach(() => {
    process.env.PORCELAIN_ARTIFACTS = file
    rmSync(dir, { recursive: true, force: true })
  })
  afterEach(() => {
    delete process.env.PORCELAIN_ARTIFACTS
    rmSync(dir, { recursive: true, force: true })
  })

  const read = (): Record<string, { title: string; html: string; updatedAt: string }> =>
    JSON.parse(readFileSync(file, 'utf8'))

  it('setArtifact writes a repo-keyed artifact with a timestamp', () => {
    const artifact = setArtifact('/repo', 'Overview', '<h1>Overview</h1>')
    expect(artifact.title).toBe('Overview')
    expect(artifact.updatedAt).not.toBe('')
    expect(read()['/repo']).toEqual({
      title: 'Overview',
      html: '<h1>Overview</h1>',
      updatedAt: artifact.updatedAt,
    })
  })

  it('setArtifact replaces an existing artifact for the repo', () => {
    setArtifact('/repo', 'First', '<p>1</p>')
    setArtifact('/repo', 'Second', '<p>2</p>')
    expect(getArtifact('/repo')?.title).toBe('Second')
    expect(getArtifact('/repo')?.html).toBe('<p>2</p>')
  })

  it('setArtifact validates before writing', () => {
    expect(() => setArtifact('/repo', '', '<p>x</p>')).toThrow('title must be a non-empty string')
    expect(existsSync(file)).toBe(false)
  })

  it('getArtifact returns the stored artifact, or null when none exists', () => {
    expect(getArtifact('/repo')).toBeNull()
    setArtifact('/repo', 'Overview', '<h1>Overview</h1>')
    expect(getArtifact('/repo')?.title).toBe('Overview')
  })

  it('clearArtifact removes only the target repo', () => {
    setArtifact('/repo', 'x', '<p>x</p>')
    setArtifact('/other', 'y', '<p>y</p>')
    clearArtifact('/repo')
    const all = read()
    expect(all['/repo']).toBeUndefined()
    expect(all['/other']).toBeDefined()
    expect(existsSync(file)).toBe(true)
  })

  it('clearArtifact is a no-op when the repo has no artifact', () => {
    setArtifact('/other', 'y', '<p>y</p>')
    clearArtifact('/repo')
    expect(read()['/other']).toBeDefined()
  })
})

describe('describeArtifact', () => {
  it('explains there is none when absent', () => {
    expect(describeArtifact('/repo', null)).toContain('No feature artifact for /repo')
  })

  it('summarizes the artifact without echoing the whole document', () => {
    const text = describeArtifact('/repo', {
      title: 'Overview',
      html: '<h1>Overview</h1>',
      updatedAt: '2026-07-04T00:00:00.000Z',
    })
    expect(text).toContain('Feature artifact "Overview" for /repo')
    expect(text).toContain('bytes of HTML')
    expect(text).not.toContain('<h1>')
  })
})
