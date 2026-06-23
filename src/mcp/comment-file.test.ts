import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { describeComments, readComments, resolveComment } from './comment-file'

describe('describeComments', () => {
  it('explains a repo with no comments', () => {
    expect(describeComments('/repo', [])).toContain('No review comments')
  })

  it('says when every comment is resolved', () => {
    expect(
      describeComments('/repo', [
        { id: 'c1', path: 'a.ts', body: 'x', resolved: true, createdAt: 1 },
      ]),
    ).toContain('No open review comments')
  })

  it('lists open comments with anchor, snippet, body, and id; hides resolved', () => {
    const text = describeComments('/repo', [
      {
        id: 'c1',
        path: 'a.ts',
        startLine: 10,
        endLine: 12,
        anchorText: 'retry(fn)',
        body: 'why unbounded?',
        resolved: false,
        createdAt: 1,
      },
      { id: 'c2', path: 'b.ts', body: 'resolved note', resolved: true, createdAt: 2 },
    ])
    expect(text).toContain('1 open review comment(s)')
    expect(text).toContain('(1 resolved)')
    expect(text).toContain('[c1] a.ts:10-12')
    expect(text).toContain('retry(fn)')
    expect(text).toContain('why unbounded?')
    expect(text).not.toContain('resolved note')
  })

  it('tags each comment with its feature-view source when a lookup is supplied', () => {
    const text = describeComments(
      '/repo',
      [
        { id: 'c1', path: 'a.ts', body: 'q', resolved: false, createdAt: 1 },
        { id: 'c2', path: 'server/svc.ts', body: 'q', resolved: false, createdAt: 2 },
        { id: 'c3', path: 'unknown.ts', body: 'q', resolved: false, createdAt: 3 },
      ],
      new Map([
        ['a.ts', 'changed'],
        ['server/svc.ts', 'shipped'],
      ]),
    )
    expect(text).toContain('[c1] a.ts (changed)')
    expect(text).toContain('[c2] server/svc.ts (shipped)')
    // a file not in the snapshot is left untagged
    expect(text).toContain('[c3] unknown.ts\n')
  })
})

describe('comment-file round-trip', () => {
  const dir = join(tmpdir(), 'porcelain-comment-file-test')
  const file = join(dir, 'comments.json')
  beforeEach(() => {
    process.env.PORCELAIN_COMMENTS = file
    rmSync(dir, { recursive: true, force: true })
  })
  afterEach(() => {
    delete process.env.PORCELAIN_COMMENTS
    rmSync(dir, { recursive: true, force: true })
  })

  const seed = (): void => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      file,
      JSON.stringify({
        '/repo': [{ id: 'c1', path: 'a.ts', body: 'x', resolved: false, createdAt: 1 }],
      }),
    )
  }

  it('reads comments and resolves one by id', () => {
    seed()
    expect(readComments('/repo')).toHaveLength(1)
    expect(resolveComment('/repo', 'c1')).toBe(true)
    expect(readComments('/repo')[0]?.resolved).toBe(true)
  })

  it('returns false resolving an unknown or already-resolved comment', () => {
    seed()
    expect(resolveComment('/repo', 'nope')).toBe(false)
    resolveComment('/repo', 'c1')
    expect(resolveComment('/repo', 'c1')).toBe(false)
  })
})
