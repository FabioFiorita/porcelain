import type { ChatMessage } from '@backend/chat-store'
import { describe, expect, it } from 'vitest'
import {
  CLAIM_TTL_MS,
  deriveChatClaims,
  isContainedClaimPath,
  normalizeClaimPath,
} from './chat-claims'

const NOW = 1_000_000_000_000

let seq = 0
function msg(overrides: Partial<ChatMessage>): ChatMessage {
  seq += 1
  return {
    id: `m${seq}`,
    from: 'alice',
    body: 'hi',
    createdAt: NOW,
    ...overrides,
  }
}

describe('normalizeClaimPath', () => {
  it('trims and strips a leading ./', () => {
    expect(normalizeClaimPath('  ./src/a.ts ')).toBe('src/a.ts')
    expect(normalizeClaimPath('src/a.ts')).toBe('src/a.ts')
  })
})

describe('isContainedClaimPath', () => {
  it('accepts repo-relative paths', () => {
    expect(isContainedClaimPath('src/a.ts')).toBe(true)
    expect(isContainedClaimPath('a.ts')).toBe(true)
  })

  it('rejects absolute paths and `..`-escapes (agent-authored → flows into readFile)', () => {
    expect(isContainedClaimPath('')).toBe(false)
    expect(isContainedClaimPath('/etc/passwd')).toBe(false)
    expect(isContainedClaimPath('../../etc/passwd')).toBe(false)
    expect(isContainedClaimPath('src/../../secret')).toBe(false)
    expect(isContainedClaimPath('C:\\Windows\\system32')).toBe(false)
    expect(isContainedClaimPath('\\\\host\\share')).toBe(false)
  })
})

describe('deriveChatClaims', () => {
  it('lists participants (distinct froms) with their last-seen time', () => {
    const { participants } = deriveChatClaims(
      [
        msg({ from: 'alice', createdAt: NOW - 5000 }),
        msg({ from: 'bob', createdAt: NOW - 4000 }),
        msg({ from: 'alice', createdAt: NOW - 1000 }),
      ],
      NOW,
    )
    expect(participants.map((p) => p.from)).toEqual(['alice', 'bob'])
    expect(participants.find((p) => p.from === 'alice')?.lastAt).toBe(NOW - 1000)
  })

  it('treats an intent-only message (no files) as not a claim', () => {
    const { liveClaims } = deriveChatClaims([msg({ intent: 'just talking' })], NOW)
    expect(liveClaims).toEqual([])
  })

  it('keeps a live claim within the TTL', () => {
    const { liveClaims } = deriveChatClaims(
      [msg({ from: 'alice', files: ['auth.ts'], intent: 'wiring', createdAt: NOW - 1000 })],
      NOW,
    )
    expect(liveClaims).toEqual([
      { from: 'alice', files: ['auth.ts'], intent: 'wiring', at: NOW - 1000 },
    ])
  })

  it('drops a claim past the TTL', () => {
    const { liveClaims } = deriveChatClaims(
      [msg({ from: 'alice', files: ['auth.ts'], createdAt: NOW - CLAIM_TTL_MS - 1 })],
      NOW,
    )
    expect(liveClaims).toEqual([])
  })

  it('a newer claim supersedes the older footprint', () => {
    const { liveClaims } = deriveChatClaims(
      [
        msg({ from: 'alice', files: ['old.ts'], createdAt: NOW - 3000 }),
        msg({ from: 'alice', files: ['new.ts'], createdAt: NOW - 1000 }),
      ],
      NOW,
    )
    expect(liveClaims).toHaveLength(1)
    expect(liveClaims[0]?.files).toEqual(['new.ts'])
  })

  it('a closes message retires the open claim', () => {
    const { liveClaims } = deriveChatClaims(
      [
        msg({ from: 'alice', files: ['auth.ts'], createdAt: NOW - 3000 }),
        msg({ from: 'alice', closes: true, createdAt: NOW - 1000 }),
      ],
      NOW,
    )
    expect(liveClaims).toEqual([])
  })

  it('a new claim after a close reopens', () => {
    const { liveClaims } = deriveChatClaims(
      [
        msg({ from: 'alice', files: ['auth.ts'], createdAt: NOW - 3000 }),
        msg({ from: 'alice', closes: true, createdAt: NOW - 2000 }),
        msg({ from: 'alice', files: ['later.ts'], createdAt: NOW - 1000 }),
      ],
      NOW,
    )
    expect(liveClaims.map((c) => c.files)).toEqual([['later.ts']])
  })

  it('normalizes and de-dupes paths in a footprint', () => {
    const { liveClaims } = deriveChatClaims(
      [msg({ from: 'alice', files: ['./a.ts', 'a.ts', ' b.ts '] })],
      NOW,
    )
    expect(liveClaims[0]?.files).toEqual(['a.ts', 'b.ts'])
  })

  it('drops path-escaping claim files, and the whole claim if nothing survives', () => {
    const { liveClaims } = deriveChatClaims(
      [
        msg({ from: 'alice', files: ['src/ok.ts', '../../etc/passwd'], createdAt: NOW - 2000 }),
        msg({ from: 'bob', files: ['/etc/shadow', '../secret'], createdAt: NOW - 1000 }),
      ],
      NOW,
    )
    // alice keeps her contained file; bob's footprint is all escapes → no live claim.
    expect(liveClaims.map((c) => ({ from: c.from, files: c.files }))).toEqual([
      { from: 'alice', files: ['src/ok.ts'] },
    ])
  })

  it('reports one overlap per pair sharing a normalized path', () => {
    const { overlaps } = deriveChatClaims(
      [
        msg({ from: 'alice', files: ['auth.ts', './session.ts'], createdAt: NOW - 2000 }),
        msg({ from: 'bob', files: ['session.ts'], createdAt: NOW - 1000 }),
      ],
      NOW,
    )
    expect(overlaps).toEqual([{ a: 'alice', b: 'bob', files: ['session.ts'] }])
  })

  it('does not report an overlap for the same agents own claims', () => {
    const { overlaps } = deriveChatClaims(
      [msg({ from: 'alice', files: ['auth.ts'], createdAt: NOW - 1000 })],
      NOW,
    )
    expect(overlaps).toEqual([])
  })
})
