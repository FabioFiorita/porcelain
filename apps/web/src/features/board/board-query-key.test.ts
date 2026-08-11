import { boardCardsQuery } from '@porcelain/client-runtime/board'
import { describe, expect, it } from 'vitest'
import { boardCardsQueryKey, isBoardCardsQueryKey } from './board-query-key'

const PROJECT = '/synthetic/repo'
const DAEMON = { host: 'beelink', version: '0.52.1' }

describe('boardCardsQueryKey', () => {
  it('composes identity + daemon scope', () => {
    const identity = boardCardsQuery(PROJECT)
    expect(boardCardsQueryKey(DAEMON, identity)).toEqual([
      identity,
      { host: DAEMON.host, version: DAEMON.version },
    ])
  })
})

describe('Board query-key parsing', () => {
  const IDENTITY = boardCardsQuery(PROJECT)

  it('accepts a well-formed key and a null-identity daemon scope', () => {
    expect(isBoardCardsQueryKey(boardCardsQueryKey(DAEMON, IDENTITY))).toBe(true)
    expect(isBoardCardsQueryKey([IDENTITY, { host: null, version: null }])).toBe(true)
  })

  it('rejects a malformed daemon scope', () => {
    expect(isBoardCardsQueryKey([IDENTITY, { host: 'beelink' }])).toBe(false)
    expect(isBoardCardsQueryKey([IDENTITY, { host: null, version: 2 }])).toBe(false)
    expect(isBoardCardsQueryKey([IDENTITY, { host: null, version: null, extra: true }])).toBe(false)
    expect(isBoardCardsQueryKey([IDENTITY, null])).toBe(false)
    expect(isBoardCardsQueryKey([IDENTITY])).toBe(false)
  })

  it('rejects malformed identities and foreign key layouts', () => {
    expect(isBoardCardsQueryKey([{ domain: 'board', name: 'cards' }, DAEMON])).toBe(false)
    expect(isBoardCardsQueryKey([{ domain: 'board', name: 'cards', projectPath: 7 }, DAEMON])).toBe(
      false,
    )
    expect(
      isBoardCardsQueryKey([{ domain: 'board', name: 'cards', projectPath: '' }, DAEMON]),
    ).toBe(false)
    expect(isBoardCardsQueryKey([{ ...IDENTITY, extra: true }, DAEMON])).toBe(false)
    expect(
      isBoardCardsQueryKey([{ domain: 'review', name: 'cards', projectPath: PROJECT }, DAEMON]),
    ).toBe(false)
    // The mobile three-tuple layout is not a Web key.
    expect(isBoardCardsQueryKey(['daemon', 'env-1', IDENTITY])).toBe(false)
    expect(isBoardCardsQueryKey([IDENTITY, DAEMON, 'extra'])).toBe(false)
  })
})
