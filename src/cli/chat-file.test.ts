import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
    postMessage(REPO, { from: 'local', body: 'need sim screenshot' })
    postMessage(REPO, { from: 'remote', body: 'sending path…' })
    const list = readMessages(REPO)
    expect(list).toHaveLength(2)
    expect(list[0]?.from).toBe('local')
    expect(describeChat(REPO, list)).toContain('need sim screenshot')
  })

  it('clears', () => {
    postMessage(REPO, { from: 'a', body: 'b' })
    expect(clearMessages(REPO)).toBe(true)
    expect(readMessages(REPO)).toEqual([])
    expect(clearMessages(REPO)).toBe(false)
  })

  it('keeps a plain message byte-identical (no claim keys serialized)', () => {
    const msg = postMessage(REPO, { from: 'local', body: 'hi' })
    expect(msg).not.toHaveProperty('files')
    expect(msg).not.toHaveProperty('intent')
    expect(msg).not.toHaveProperty('closes')
  })

  it('stores a claim with trimmed files + intent, capping to the schema limits', () => {
    postMessage(REPO, {
      from: 'alice',
      body: 'wiring login',
      files: [' auth.ts ', 'session.ts', '  '],
      intent: '  wiring login  ',
    })
    const [claim] = readMessages(REPO)
    expect(claim?.files).toEqual(['auth.ts', 'session.ts'])
    expect(claim?.intent).toBe('wiring login')
  })

  it('caps a runaway claim to 50 files so the app schema never rejects it', () => {
    const files = Array.from({ length: 80 }, (_, i) => `f${i}.ts`)
    postMessage(REPO, { from: 'bot', body: 'lots', files })
    expect(readMessages(REPO)[0]?.files).toHaveLength(50)
  })

  it('parseMessages degrades a malformed claim to a plain message (never throws)', () => {
    postMessage(REPO, { from: 'x', body: 'has bad files' })
    // Hand-write a message with a malformed files field, as an external writer might.
    const raw = JSON.parse(readFileSync(file, 'utf8'))
    raw[REPO][0].files = ['ok.ts', 42]
    raw[REPO][0].intent = ''
    writeFileSync(file, JSON.stringify(raw))
    const [msg] = readMessages(REPO)
    expect(msg?.files).toBeUndefined()
    expect(msg?.intent).toBeUndefined()
    expect(msg?.body).toBe('has bad files')
  })

  it('describeChat renders a claim line and a derived Live-claims + Overlap block', () => {
    postMessage(REPO, { from: 'alice', body: 'wiring login', files: ['auth.ts', 'session.ts'] })
    postMessage(REPO, {
      from: 'bob',
      body: 'logout',
      files: ['session.ts'],
      intent: 'adding logout',
    })
    const text = describeChat(REPO, readMessages(REPO))
    expect(text).toContain('[CLAIM]')
    expect(text).toContain('files: auth.ts, session.ts')
    expect(text).toContain('Live claims (2):')
    expect(text).toContain('⚠ Overlap: alice & bob both touching session.ts')
  })

  it('describeChat drops a closed claim from the Live-claims block', () => {
    postMessage(REPO, { from: 'alice', body: 'wiring login', files: ['auth.ts'] })
    postMessage(REPO, { from: 'alice', body: 'done', closes: true })
    const text = describeChat(REPO, readMessages(REPO))
    expect(text).toContain('[CLOSED]')
    expect(text).not.toContain('Live claims')
  })
})
