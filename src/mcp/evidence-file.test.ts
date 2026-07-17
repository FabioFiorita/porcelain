import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearEvidence,
  describeEvidence,
  evidenceDirForRepo,
  getEvidence,
  MAX_HTML_BYTES,
  prepareEvidence,
  setEvidence,
  validateEvidence,
} from './evidence-file'

describe('validateEvidence', () => {
  it('accepts a non-empty title + html', () => {
    expect(validateEvidence('Title', '<p>hi</p>')).toEqual({ title: 'Title', html: '<p>hi</p>' })
  })

  it('throws on an empty or non-string title', () => {
    expect(() => validateEvidence('', '<p>hi</p>')).toThrow('title must be a non-empty string')
  })

  it('throws when the html exceeds the size cap', () => {
    expect(() => validateEvidence('Title', 'x'.repeat(MAX_HTML_BYTES + 1))).toThrow('over the')
  })
})

describe('evidence directory channel', () => {
  const root = join(tmpdir(), 'porcelain-mcp-evidence-test')
  const diskRoot = join(root, 'loop-evidence')
  const legacy = join(root, 'evidence.json')

  beforeEach(() => {
    process.env.PORCELAIN_LOOP_EVIDENCE_DIR = diskRoot
    process.env.PORCELAIN_EVIDENCE = legacy
    rmSync(root, { recursive: true, force: true })
    mkdirSync(root, { recursive: true })
  })
  afterEach(() => {
    delete process.env.PORCELAIN_LOOP_EVIDENCE_DIR
    delete process.env.PORCELAIN_EVIDENCE
    rmSync(root, { recursive: true, force: true })
  })

  it('prepareEvidence creates the dir + meta without index.html', () => {
    const { dir, title } = prepareEvidence('/repo', 'SPA redirect')
    expect(title).toBe('SPA redirect')
    expect(dir).toBe(evidenceDirForRepo('/repo'))
    expect(existsSync(join(dir, 'meta.json'))).toBe(true)
    expect(existsSync(join(dir, 'index.html'))).toBe(false)
  })

  it('setEvidence writes index.html into the directory', () => {
    const evidence = setEvidence('/repo', 'Vite loop', '<h1>Pass</h1>')
    expect(evidence.dir).toBe(evidenceDirForRepo('/repo'))
    expect(readFileSync(join(evidence.dir, 'index.html'), 'utf8')).toBe('<h1>Pass</h1>')
    expect(getEvidence('/repo')?.title).toBe('Vite loop')
  })

  it('agent can Write index.html after prepare and getEvidence sees it', () => {
    const { dir } = prepareEvidence('/repo', 'Manual write')
    writeFileSync(join(dir, 'index.html'), '<p>from disk</p>')
    expect(getEvidence('/repo')?.html).toBe('<p>from disk</p>')
  })

  it('clearEvidence removes the directory', () => {
    const { dir } = prepareEvidence('/repo', 'X')
    setEvidence('/repo', 'X', '<p>x</p>')
    clearEvidence('/repo')
    expect(existsSync(dir)).toBe(false)
    expect(getEvidence('/repo')).toBeNull()
  })

  it('describeEvidence points at the directory when index exists', () => {
    setEvidence('/repo', 'Vite loop', '<h1>Pass</h1>')
    const text = describeEvidence('/repo', getEvidence('/repo'))
    expect(text).toContain('index.html')
    expect(text).toContain(evidenceDirForRepo('/repo'))
  })

  it('describeEvidence without evidence explains the prepare flow', () => {
    expect(describeEvidence('/repo', null)).toContain('set_loop_evidence')
    expect(describeEvidence('/repo', null)).toContain('index.html')
  })
})
