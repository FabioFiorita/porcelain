import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  checkEvidence,
  clearEvidence,
  describeEvidence,
  evidenceDirForRepo,
  getEvidence,
  prepareEvidence,
  setEvidence,
} from './evidence-file'

const root = join(tmpdir(), 'porcelain-evidence-file-test')
const repo = join(root, 'repo')

beforeEach(() => {
  rmSync(root, { recursive: true, force: true })
  mkdirSync(repo, { recursive: true })
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('evidence directory channel', () => {
  it('prepareEvidence creates the dir + meta without index.html', () => {
    const { dir, title } = prepareEvidence(repo, 'Loop')
    expect(title).toBe('Loop')
    expect(dir).toBe(evidenceDirForRepo(repo))
    expect(existsSync(join(dir, 'meta.json'))).toBe(true)
    expect(existsSync(join(dir, 'index.html'))).toBe(false)
  })

  it('agent can Write index.html after prepare and getEvidence sees it', () => {
    prepareEvidence(repo, 'Loop')
    writeFileSync(join(evidenceDirForRepo(repo), 'index.html'), '<h1>ok</h1>')
    expect(getEvidence(repo)?.html).toBe('<h1>ok</h1>')
  })

  it('setEvidence writes index.html into the directory', () => {
    const e = setEvidence(repo, 'T', '<p>hi</p>')
    expect(e.dir).toBe(evidenceDirForRepo(repo))
    expect(readFileSync(join(e.dir, 'index.html'), 'utf8')).toBe('<p>hi</p>')
  })

  it('clearEvidence removes the directory', () => {
    setEvidence(repo, 'T', '<p>hi</p>')
    clearEvidence(repo)
    expect(existsSync(evidenceDirForRepo(repo))).toBe(false)
  })

  it('checkEvidence creates the meta when missing', () => {
    const r = checkEvidence(repo, 'unit', 'pass', undefined)
    expect(r.title).toBe('Evidence')
    expect(r.checks).toHaveLength(1)
  })

  it('checkEvidence appends distinct checks and keeps the prepared title', () => {
    prepareEvidence(repo, 'Loop')
    checkEvidence(repo, 'a', 'pass', undefined)
    checkEvidence(repo, 'b', 'fail', 'nope')
    const r = checkEvidence(repo, 'c', 'skip', undefined)
    expect(r.title).toBe('Loop')
    expect(r.checks.map((c) => c.label)).toEqual(['a', 'b', 'c'])
  })

  it('checkEvidence replaces a check with the same label', () => {
    checkEvidence(repo, 'a', 'fail', undefined)
    const r = checkEvidence(repo, 'a', 'pass', undefined)
    expect(r.checks).toHaveLength(1)
    expect(r.checks[0]?.status).toBe('pass')
  })

  it('describeEvidence points at the directory when index exists', () => {
    setEvidence(repo, 'T', '<p>preview me</p>')
    const text = describeEvidence(repo, getEvidence(repo))
    expect(text).toContain('preview me')
    expect(text).toContain(evidenceDirForRepo(repo))
  })

  it('describeEvidence includes the checks summary', () => {
    setEvidence(repo, 'T', '<p>x</p>')
    checkEvidence(repo, 'unit', 'pass', undefined)
    const text = describeEvidence(repo, getEvidence(repo))
    expect(text).toMatch(/Checks:|pass/i)
  })

  it('prepareEvidence wipes prior HTML', () => {
    setEvidence(repo, 'Old', '<p>old</p>')
    prepareEvidence(repo, 'New')
    expect(existsSync(join(evidenceDirForRepo(repo), 'index.html'))).toBe(false)
  })

  it('setEvidence replaces the directory so old screenshots cannot linger', () => {
    const dir = evidenceDirForRepo(repo)
    setEvidence(repo, 'A', '<p>1</p>')
    writeFileSync(join(dir, 'shot.png'), 'png')
    setEvidence(repo, 'B', '<p>2</p>')
    expect(existsSync(join(dir, 'shot.png'))).toBe(false)
  })
})
