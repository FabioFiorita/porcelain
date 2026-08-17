#!/usr/bin/env node
/**
 * Fixture tests for the pillar gate. Each one breaks the guard on purpose: a gate that cannot be
 * shown failing is a gate nobody should trust.
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'
import { checkPillars, scanDirectories } from './lint-pillars.mjs'

const roots = ['apps/web/src/features']
const scratch = mkdtempSync(join(tmpdir(), 'lint-pillars-'))
after(() => rmSync(scratch, { recursive: true, force: true }))

function withDirectories(name, names) {
  const base = join(scratch, name)
  for (const dir of names) mkdirSync(join(base, roots[0], dir), { recursive: true })
  return base
}

describe('scanDirectories', () => {
  it('finds each immediate subdirectory of a watched root', () => {
    const base = withDirectories('scan', ['files', 'git'])
    assert.deepEqual(scanDirectories(base, roots), [
      'apps/web/src/features/files',
      'apps/web/src/features/git',
    ])
  })

  it('ignores a watched root that does not exist', () => {
    assert.deepEqual(scanDirectories(join(scratch, 'absent'), roots), [])
  })
})

describe('checkPillars', () => {
  const manifest = { directories: { 'apps/web/src/features/files': 'pillar-2' } }

  it('accepts a directory whose declared status is a known pillar', () => {
    assert.deepEqual(checkPillars(manifest, ['apps/web/src/features/files']), [])
  })

  it('accepts supporting and frozen alongside numbered pillars', () => {
    const mixed = {
      directories: {
        'apps/web/src/features/search': 'supporting',
        'apps/mobile/src/features/git': 'frozen',
      },
    }
    assert.deepEqual(
      checkPillars(mixed, ['apps/web/src/features/search', 'apps/mobile/src/features/git']),
      [],
    )
  })

  it('rejects a directory on disk that declares no pillar', () => {
    const problems = checkPillars(manifest, [
      'apps/web/src/features/files',
      'apps/web/src/features/harness_leftover',
    ])
    assert.equal(problems.length, 1)
    assert.match(problems[0], /harness_leftover declares no pillar/)
  })

  it('rejects a status outside the known set', () => {
    const bogus = { directories: { 'apps/web/src/features/files': 'someday' } }
    const problems = checkPillars(bogus, ['apps/web/src/features/files'])
    assert.equal(problems.length, 1)
    assert.match(problems[0], /unknown status "someday"/)
  })

  it('rejects a manifest entry with no directory behind it', () => {
    const problems = checkPillars(manifest, [])
    assert.equal(problems.length, 1)
    assert.match(problems[0], /not on disk — remove the stale entry/)
  })

  it('reports every undeclared directory rather than stopping at the first', () => {
    const problems = checkPillars({ directories: {} }, [
      'apps/web/src/features/one',
      'apps/web/src/features/two',
    ])
    assert.equal(problems.length, 2)
  })

  it('treats a manifest with no directories key as declaring nothing', () => {
    const problems = checkPillars({}, ['apps/web/src/features/files'])
    assert.equal(problems.length, 1)
    assert.match(problems[0], /declares no pillar/)
  })
})
