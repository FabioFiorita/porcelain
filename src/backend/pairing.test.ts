import { beforeEach, describe, expect, it } from 'vitest'
import {
  cancelPairing,
  generatePairingCode,
  MAX_PAIRING_ATTEMPTS,
  normalizePairingCode,
  PAIRING_TTL_MS,
  pendingPairing,
  redeemPairing,
  startPairing,
} from './pairing'

const T0 = 1_700_000_000_000

// A deterministic "random" source: byte i = i, so the code is the first CODE_LENGTH
// letters of the alphabet.
const fixedBytes = (size: number): Buffer => Buffer.from(Array.from({ length: size }, (_, i) => i))

beforeEach(() => {
  cancelPairing()
})

describe('generatePairingCode', () => {
  it('is 8 alphabet characters, grouped for reading aloud', () => {
    expect(generatePairingCode(fixedBytes)).toBe('0123-4567')
  })

  it('never emits the look-alike characters Crockford drops', () => {
    // 256 draws covers every byte value, so every reachable alphabet slot is hit.
    for (let seed = 0; seed < 256; seed++) {
      const code = generatePairingCode((size) => Buffer.alloc(size, seed))
      expect(code).not.toMatch(/[ILOU]/)
    }
  })
})

describe('normalizePairingCode', () => {
  it('strips separators and whitespace', () => {
    expect(normalizePairingCode('abcd-efgh')).toBe('ABCDEFGH')
    expect(normalizePairingCode(' ab cd ef gh ')).toBe('ABCDEFGH')
  })

  it('folds the look-alikes a human types instead of the real character', () => {
    expect(normalizePairingCode('O0')).toBe('00')
    expect(normalizePairingCode('I1')).toBe('11')
    expect(normalizePairingCode('L1')).toBe('11')
  })
})

describe('pairing lifecycle', () => {
  it('has nothing pending until a human starts one', () => {
    expect(pendingPairing(T0)).toBeNull()
    // Nothing pending must refuse — this is what makes the /pair route 404 at rest.
    expect(redeemPairing('0123-4567', T0)).toBe('none')
  })

  it('redeems the code it minted', () => {
    const { code } = startPairing(T0, fixedBytes)
    expect(redeemPairing(code, T0 + 1000)).toBe('ok')
  })

  it('redeems a code the human retyped without the separator or in lower case', () => {
    startPairing(T0, fixedBytes)
    expect(redeemPairing('01234567', T0 + 1000)).toBe('ok')
  })

  it('is single-use — a redeemed code cannot be replayed', () => {
    const { code } = startPairing(T0, fixedBytes)
    expect(redeemPairing(code, T0 + 1000)).toBe('ok')
    expect(redeemPairing(code, T0 + 2000)).toBe('none')
  })

  it('expires after the TTL', () => {
    const { code } = startPairing(T0, fixedBytes)
    expect(redeemPairing(code, T0 + PAIRING_TTL_MS)).toBe('expired')
  })

  it('stops reporting a pending code once it has aged out', () => {
    startPairing(T0, fixedBytes)
    expect(pendingPairing(T0 + PAIRING_TTL_MS - 1)).not.toBeNull()
    expect(pendingPairing(T0 + PAIRING_TTL_MS)).toBeNull()
  })

  it('burns the code after the attempt limit, so it cannot be ground down', () => {
    const { code } = startPairing(T0, fixedBytes)
    for (let i = 0; i < MAX_PAIRING_ATTEMPTS; i++) {
      expect(redeemPairing('WRON-GWRO', T0 + 1000)).toBe('invalid')
    }
    // Even the RIGHT code is refused now — re-minting is the only way forward.
    expect(redeemPairing(code, T0 + 1000)).toBe('none')
  })

  it('resets the attempt budget when a fresh code is minted', () => {
    startPairing(T0, fixedBytes)
    for (let i = 0; i < MAX_PAIRING_ATTEMPTS - 1; i++) redeemPairing('WRON-GWRO', T0)
    const { code } = startPairing(T0, fixedBytes)
    expect(redeemPairing('WRON-GWRO', T0)).toBe('invalid')
    expect(redeemPairing(code, T0)).toBe('ok')
  })

  it('replaces a pending code rather than accumulating — the old one stops working', () => {
    const first = startPairing(T0, fixedBytes)
    const second = startPairing(T0, (size) => Buffer.alloc(size, 9))
    expect(second.code).not.toBe(first.code)
    expect(redeemPairing(first.code, T0)).toBe('invalid')
  })

  it('cancels on request', () => {
    const { code } = startPairing(T0, fixedBytes)
    cancelPairing()
    expect(pendingPairing(T0)).toBeNull()
    expect(redeemPairing(code, T0)).toBe('none')
  })
})
