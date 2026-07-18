import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearMessages, describeChat, postMessage, readMessages } from './chat-file'

const dir = join(tmpdir(), 'porcelain-chat-file-test')
const file = join(dir, 'chat.json')
const REPO = '/repo'

describe('chat-file', () => {
  beforeEach(() => {
    process.env.PORCELAIN_CHAT = file
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
  })
  afterEach(() => {
    delete process.env.PORCELAIN_CHAT
    rmSync(dir, { recursive: true, force: true })
  })

  it('round-trips posts', () => {
    postMessage(REPO, 'local', 'need sim screenshot')
    postMessage(REPO, 'remote', 'sending path…')
    const list = readMessages(REPO)
    expect(list).toHaveLength(2)
    expect(list[0]?.from).toBe('local')
    expect(describeChat(REPO, list)).toContain('need sim screenshot')
  })

  it('clears', () => {
    postMessage(REPO, 'a', 'b')
    expect(clearMessages(REPO)).toBe(true)
    expect(readMessages(REPO)).toEqual([])
    expect(clearMessages(REPO)).toBe(false)
  })
})
