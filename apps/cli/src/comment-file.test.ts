import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { COMMENTS_FILE_MAX_BYTES } from '@porcelain/shared/comments-file'
import {
  ACTIVE_FILES,
  projectActiveReviewDir,
  projectPorcelainPath,
} from '@shared/project-porcelain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { answerComment, describeComments, readComments, resolveComment } from './comment-file'

const root = join(tmpdir(), 'porcelain-comment-file-test')
const repo = join(root, 'repo')

function seedV1(comments: unknown[]): void {
  mkdirSync(projectActiveReviewDir(repo), { recursive: true })
  writeFileSync(
    projectPorcelainPath(repo, ACTIVE_FILES.comments),
    JSON.stringify({ version: 1, comments }, null, 2),
  )
}

describe('describeComments', () => {
  it('explains a repo with no comments', () => {
    expect(describeComments(repo, [])).toContain('No review comments')
  })

  it('says when every comment is resolved', () => {
    expect(
      describeComments(repo, [{ id: 'c1', path: 'a.ts', body: 'x', resolved: true, createdAt: 1 }]),
    ).toContain('No open review comments')
  })

  it('lists open comments with anchor, snippet, body, and id; hides resolved', () => {
    const text = describeComments(repo, [
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
      repo,
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
    expect(text).toContain('[c3] unknown.ts\n')
  })
})

describe('comment-file v1 round-trip', () => {
  beforeEach(() => {
    rmSync(root, { recursive: true, force: true })
    mkdirSync(repo, { recursive: true })
  })
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  const seed = (): void => {
    seedV1([
      {
        id: 'c1',
        path: 'a.ts',
        startLine: 10,
        body: 'why?',
        resolved: false,
        createdAt: 1,
      },
    ])
  }

  it('reads comments and resolves one by id', () => {
    seed()
    expect(readComments(repo)).toHaveLength(1)
    expect(resolveComment(repo, 'c1')).toBe(true)
    expect(readComments(repo)[0]?.resolved).toBe(true)
  })

  it('returns false resolving an unknown or already-resolved comment', () => {
    seed()
    expect(resolveComment(repo, 'nope')).toBe(false)
    resolveComment(repo, 'c1')
    expect(resolveComment(repo, 'c1')).toBe(false)
  })

  it('attaches an agent reply by id and reads it back', () => {
    seed()
    expect(answerComment(repo, 'c1', 'because MAX')).toBe(true)
    expect(readComments(repo)[0]?.agentReply?.body).toBe('because MAX')
  })

  it('overwrites the reply on a second answer', () => {
    seed()
    answerComment(repo, 'c1', 'first')
    answerComment(repo, 'c1', 'second')
    expect(readComments(repo)[0]?.agentReply?.body).toBe('second')
  })

  it('returns false answering an unknown id or a blank body', () => {
    seed()
    expect(answerComment(repo, 'nope', 'x')).toBe(false)
    expect(answerComment(repo, 'c1', '  ')).toBe(false)
  })

  it('does not strip an agent reply when resolving', () => {
    seed()
    answerComment(repo, 'c1', 'kept')
    resolveComment(repo, 'c1')
    expect(readComments(repo)[0]?.agentReply?.body).toBe('kept')
  })

  it('refuses an answer that would exceed the shared document bound without replacing the file', () => {
    seed()
    const path = projectPorcelainPath(repo, ACTIVE_FILES.comments)
    const before = readFileSync(path, 'utf8')

    expect(answerComment(repo, 'c1', 'x'.repeat(COMMENTS_FILE_MAX_BYTES))).toBe(false)
    expect(readFileSync(path, 'utf8')).toBe(before)
  })

  it('rejects legacy top-level arrays without coercing', () => {
    mkdirSync(projectActiveReviewDir(repo), { recursive: true })
    writeFileSync(
      projectPorcelainPath(repo, ACTIVE_FILES.comments),
      JSON.stringify([{ id: 'c1', path: 'a.ts', body: 'x', resolved: false, createdAt: 1 }]),
    )
    expect(() => readComments(repo)).toThrow(/top-level arrays|version 1/)
  })
})
