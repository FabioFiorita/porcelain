import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import { readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  accessSnapshot,
  authenticateClientToken,
  exchangePairingGrant,
  issuePairingGrant,
  revokeAuthorizedClient,
  revokePairingGrant,
} from './access-store'

const dir = join(tmpdir(), 'porcelain-access-store-test')
const file = join(dir, 'access.json')

beforeEach(async () => {
  await rm(dir, { recursive: true, force: true })
  process.env.PORCELAIN_ACCESS_FILE = file
})

afterEach(async () => {
  delete process.env.PORCELAIN_ACCESS_FILE
  await rm(dir, { recursive: true, force: true })
})

describe('access store', () => {
  it('issues a short-lived grant without persisting its plaintext credential', async () => {
    const now = Date.now()
    const grant = await issuePairingGrant('My iPhone', now)
    expect(grant.credential).toMatch(/^pc_pair_/)
    expect(await accessSnapshot()).toEqual({
      pairings: [
        {
          id: grant.id,
          label: 'My iPhone',
          createdAt: new Date(now).toISOString(),
          expiresAt: new Date(now + 15 * 60 * 1000).toISOString(),
        },
      ],
      clients: [],
    })
    expect(await readFile(file, 'utf8')).not.toContain(grant.credential)
    expect(statSync(file).mode & 0o777).toBe(0o600)
  })

  it('consumes a grant once and authenticates only its issued client token', async () => {
    const grant = await issuePairingGrant('iPad')
    const exchanged = await exchangePairingGrant(grant.credential)
    expect(exchanged?.token).toMatch(/^pc_client_/)
    expect(await exchangePairingGrant(grant.credential)).toBeNull()
    expect(await authenticateClientToken('wrong')).toBeNull()
    expect(await authenticateClientToken(exchanged?.token ?? '')).toEqual({
      kind: 'client',
      clientId: exchanged?.client.id,
      label: 'iPad',
    })
  })

  it('rejects expired grants and supports individual revocation', async () => {
    const first = await issuePairingGrant('Phone', 1_000)
    expect(await exchangePairingGrant(first.credential, 1_000 + 15 * 60 * 1000)).toBeNull()

    const second = await issuePairingGrant('Mac')
    expect(await revokePairingGrant(second.id)).toBe(true)
    expect(await exchangePairingGrant(second.credential)).toBeNull()

    const third = await issuePairingGrant('Tablet')
    const exchanged = await exchangePairingGrant(third.credential)
    expect(await revokeAuthorizedClient(exchanged?.client.id ?? '')).toBe(true)
    expect(await authenticateClientToken(exchanged?.token ?? '')).toBeNull()
  })

  it('treats a missing access file as empty', async () => {
    expect(await accessSnapshot()).toEqual({ pairings: [], clients: [] })
  })

  it('renames a malformed access file to a corrupt backup then reads empty', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(file, '{not-json', 'utf8')
    const before = Date.now()

    expect(await accessSnapshot()).toEqual({ pairings: [], clients: [] })

    const after = Date.now()
    const backups = (await readdir(dir)).filter((name) => name.startsWith('access.json.corrupt-'))
    expect(backups).toHaveLength(1)
    const stamp = Number(backups[0]?.slice('access.json.corrupt-'.length))
    expect(stamp).toBeGreaterThanOrEqual(before)
    expect(stamp).toBeLessThanOrEqual(after)
  })

  it('treats an oversized access file as empty', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(file, Buffer.alloc(1_048_576 + 1, 0x20))

    expect(await accessSnapshot()).toEqual({ pairings: [], clients: [] })
  })
})
