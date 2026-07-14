import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  addComment,
  clearResolvedComments,
  deleteComment,
  editComment,
  readComments,
  setCommentResolved,
} from './comment-store'

const dir = join(tmpdir(), 'porcelain-comment-store-test')
const file = join(dir, 'comments.json')

beforeEach(() => {
  process.env.PORCELAIN_COMMENTS = file
  rmSync(dir, { recursive: true, force: true })
})
afterEach(() => {
  delete process.env.PORCELAIN_COMMENTS
  rmSync(dir, { recursive: true, force: true })
})

describe('comment-store CRUD', () => {
  it('adds a line comment and reads it back', async () => {
    const comment = await addComment('/repo', {
      path: 'src/a.ts',
      startLine: 10,
      endLine: 12,
      anchorText: 'retry(fn)',
      body: 'why unbounded?',
    })
    expect(comment.resolved).toBe(false)
    const comments = await readComments('/repo')
    expect(comments).toHaveLength(1)
    expect(comments[0]).toMatchObject({
      path: 'src/a.ts',
      startLine: 10,
      endLine: 12,
      body: 'why unbounded?',
    })
  })

  it('adds a file-level comment (no line range)', async () => {
    await addComment('/repo', { path: 'src/db.ts', body: 'document the schema' })
    const comment = (await readComments('/repo'))[0]
    expect(comment?.startLine).toBeUndefined()
  })

  it('edits a comment body', async () => {
    const { id } = await addComment('/repo', { path: 'a.ts', body: 'old' })
    await editComment('/repo', id, 'new')
    expect((await readComments('/repo'))[0]?.body).toBe('new')
  })

  it('resolves and reopens a comment', async () => {
    const { id } = await addComment('/repo', { path: 'a.ts', body: 'x' })
    await setCommentResolved('/repo', id, true)
    expect((await readComments('/repo'))[0]?.resolved).toBe(true)
    await setCommentResolved('/repo', id, false)
    expect((await readComments('/repo'))[0]?.resolved).toBe(false)
  })

  it('deletes a comment', async () => {
    const { id } = await addComment('/repo', { path: 'a.ts', body: 'x' })
    await deleteComment('/repo', id)
    expect(await readComments('/repo')).toEqual([])
  })

  it('clears only resolved comments, leaving open ones', async () => {
    const open = await addComment('/repo', { path: 'a.ts', body: 'still open' })
    const closed = await addComment('/repo', { path: 'b.ts', body: 'done' })
    await setCommentResolved('/repo', closed.id, true)
    await clearResolvedComments('/repo')
    const remaining = await readComments('/repo')
    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.id).toBe(open.id)
    expect(remaining[0]?.resolved).toBe(false)
  })

  it('preserves an agent reply across an app-side edit and resolve', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      file,
      JSON.stringify({
        '/repo': [
          {
            id: 'a',
            path: 'a.ts',
            body: 'why unbounded?',
            resolved: false,
            createdAt: 1,
            agentReply: { body: 'bounded by MAX_RETRIES', createdAt: 2 },
          },
        ],
      }),
    )
    await editComment('/repo', 'a', 'why unbounded here?')
    await setCommentResolved('/repo', 'a', true)
    const comment = (await readComments('/repo'))[0]
    expect(comment?.body).toBe('why unbounded here?')
    expect(comment?.resolved).toBe(true)
    expect(comment?.agentReply).toEqual({ body: 'bounded by MAX_RETRIES', createdAt: 2 })
  })

  it('returns comments newest first (by createdAt)', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      file,
      JSON.stringify({
        '/repo': [
          { id: 'a', path: 'a.ts', body: 'older', resolved: false, createdAt: 1 },
          { id: 'b', path: 'b.ts', body: 'newer', resolved: false, createdAt: 2 },
        ],
      }),
    )
    expect((await readComments('/repo')).map((c) => c.body)).toEqual(['newer', 'older'])
  })
})
