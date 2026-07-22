import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  checkEvidence,
  clearEvidence,
  describeEvidence,
  evidenceDirForRepo,
  evidenceOverallStatus,
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

  it('describeEvidence points at the directory when index exists, with a preview', () => {
    setEvidence('/repo', 'Vite loop', '<h1>Pass</h1>')
    const text = describeEvidence('/repo', getEvidence('/repo'))
    expect(text).toContain('index.html')
    expect(text).toContain(evidenceDirForRepo('/repo'))
    expect(text).toContain('Preview:')
    expect(text).toContain('<h1>Pass</h1>')
  })

  it('describeEvidence without evidence explains the prepare flow', () => {
    expect(describeEvidence('/repo', null)).toContain('evidence prepare')
    expect(describeEvidence('/repo', null)).toContain('index.html')
  })

  const readChecks = (repo: string): unknown => {
    const meta = JSON.parse(readFileSync(join(evidenceDirForRepo(repo), 'meta.json'), 'utf8')) as {
      checks?: unknown
    }
    return meta.checks
  }

  it('checkEvidence creates the meta when missing (title falls back to Evidence)', () => {
    const result = checkEvidence('/repo', 'pnpm test', 'pass', '1348 passed')
    expect(result.title).toBe('Evidence')
    expect(result.checks).toEqual([{ label: 'pnpm test', status: 'pass', detail: '1348 passed' }])
    expect(existsSync(join(evidenceDirForRepo('/repo'), 'meta.json'))).toBe(true)
  })

  it('checkEvidence appends distinct checks and keeps the prepared title', () => {
    prepareEvidence('/repo', 'Login smoke test')
    checkEvidence('/repo', 'pnpm lint', 'pass', undefined)
    const result = checkEvidence('/repo', 'pnpm build', 'skip', undefined)
    expect(result.title).toBe('Login smoke test')
    expect(result.checks.map((c) => c.label)).toEqual(['pnpm lint', 'pnpm build'])
    expect(readChecks('/repo')).toHaveLength(2)
  })

  it('checkEvidence replaces a check with the same label instead of duplicating', () => {
    checkEvidence('/repo', 'pnpm test', 'fail', '2 failed')
    const result = checkEvidence('/repo', 'pnpm test', 'pass', '1348 passed')
    expect(result.checks).toEqual([{ label: 'pnpm test', status: 'pass', detail: '1348 passed' }])
    expect(evidenceOverallStatus(result.checks)).toBe('pass')
  })

  it('checkEvidence enforces the count cap (33rd distinct check throws)', () => {
    for (let i = 0; i < 32; i++) checkEvidence('/repo', `check ${i}`, 'pass', undefined)
    expect(() => checkEvidence('/repo', 'check 32', 'pass', undefined)).toThrow('too many checks')
  })

  it('checkEvidence rejects an over-long label and an unknown status', () => {
    expect(() => checkEvidence('/repo', 'x'.repeat(121), 'pass', undefined)).toThrow('over the')
    expect(() => checkEvidence('/repo', 'ok', 'bogus', undefined)).toThrow('pass|fail|skip')
  })

  it('describeEvidence warns when estimated inlined size exceeds the viewer cap', () => {
    const { dir } = prepareEvidence('/repo', 'Big shots')
    writeFileSync(join(dir, 'index.html'), '<img src="shot.png">')
    // ~3.2 MB sibling → base64 estimate over 4 MB
    writeFileSync(join(dir, 'shot.png'), Buffer.alloc(3_200_000, 1))
    const text = describeEvidence('/repo', getEvidence('/repo'))
    expect(text).toContain('WARNING')
    expect(text).toContain('Evidence too large')
    expect(text).toContain('viewer cap')
  })

  it('describeEvidence includes the checks summary + derived status', () => {
    setEvidence('/repo', 'Loop', '<h1>ok</h1>')
    checkEvidence('/repo', 'pnpm test', 'pass', '1348 passed')
    checkEvidence('/repo', 'pnpm build', 'fail', 'tsc error')
    const text = describeEvidence('/repo', getEvidence('/repo'))
    expect(text).toContain('Checks: 2')
    expect(text).toContain('FAIL')
  })
})
