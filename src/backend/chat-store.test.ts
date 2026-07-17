import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearMessages, MAX_CHAT_MESSAGES, postMessage, readMessages } from './chat-store'

const REPO = '/Users/me/Code/proj'

describe('chat-store', () => {
  let dir: string
  let prev: string | undefined

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'porcelain-chat-'))
    prev = process.env.PORCELAIN_CHAT
    process.env.PORCELAIN_CHAT = join(dir, 'chat.json')
  })

  afterEach(async () => {
    if (prev === undefined) delete process.env.PORCELAIN_CHAT
    else process.env.PORCELAIN_CHAT = prev
    await rm(dir, { recursive: true, force: true })
  })

  it('posts and lists messages oldest-first', async () => {
    const a = await postMessage(REPO, { from: 'local', body: 'hello' })
    const b = await postMessage(REPO, { from: 'remote', body: 'hi back' })
    const list = await readMessages(REPO)
    expect(list.map((m) => m.id)).toEqual([a.id, b.id])
    expect(list[0]?.from).toBe('local')
    expect(list[1]?.body).toBe('hi back')
  })

  it('clears the repo thread', async () => {
    await postMessage(REPO, { from: 'local', body: 'x' })
    await clearMessages(REPO)
    expect(await readMessages(REPO)).toEqual([])
  })

  it('drops oldest when over the cap', async () => {
    for (let i = 0; i < MAX_CHAT_MESSAGES + 5; i++) {
      await postMessage(REPO, { from: 'bot', body: `m${i}` })
    }
    const list = await readMessages(REPO)
    expect(list).toHaveLength(MAX_CHAT_MESSAGES)
    expect(list[0]?.body).toBe('m5')
    expect(list[list.length - 1]?.body).toBe(`m${MAX_CHAT_MESSAGES + 4}`)
  })
})
