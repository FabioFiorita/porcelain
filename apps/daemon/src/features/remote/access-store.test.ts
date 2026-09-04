import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import { readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  accessSnapshot,
  authenticateClientToken,
  ensureDevClientToken,
  exchangePairingGrant,
  issuePairingGrant,
  revokeAuthorizedClient,
  revokePairingGrant,
} from './access-store'

const dir = join(tmpdir(), 'porcelain-access-store-test')
const file = join(dir, 'access.json')
const devTokenFile = join(dir, 'dev-client-token')

beforeEach(async () => {
  await rm(dir, { recursive: true, force: true })
  process.env.PORCELAIN_ACCESS_FILE = file
  process.env.PORCELAIN_DEV_CLIENT_TOKEN_FILE = devTokenFile
})

afterEach(async () => {
  delete process.env.PORCELAIN_ACCESS_FILE
  delete process.env.PORCELAIN_DEV_CLIENT_TOKEN_FILE
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
    if (process.platform !== 'win32') expect(statSync(file).mode & 0o777).toBe(0o600)
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

  it('reuses the development client credential across calls', async () => {
    const first = await ensureDevClientToken()
    expect(first).toMatch(/^pc_client_dev-auto-auth_/)
    expect(await ensureDevClientToken()).toBe(first)
    expect(await authenticateClientToken(first)).toEqual({
      kind: 'client',
      clientId: 'dev-auto-auth',
      label: 'Dev auto-auth',
    })
    expect((await accessSnapshot()).clients).toHaveLength(1)
  })

  it('keeps the development credential readable only by its owner', async () => {
    await ensureDevClientToken()
    if (process.platform !== 'win32') expect(statSync(devTokenFile).mode & 0o777).toBe(0o600)
  })

  it('re-mints when the plaintext is gone but the record survives', async () => {
    const first = await ensureDevClientToken()
    await rm(devTokenFile)

    const second = await ensureDevClientToken()

    // A hash cannot be reversed, so the old plaintext is unrecoverable and must not
    // keep authenticating once the file it lived in is gone.
    expect(second).not.toBe(first)
    expect(await authenticateClientToken(second)).not.toBeNull()
    expect(await authenticateClientToken(first)).toBeNull()
    expect((await accessSnapshot()).clients).toHaveLength(1)
  })

  it('re-mints when the record is gone but the plaintext survives', async () => {
    const first = await ensureDevClientToken()
    await revokeAuthorizedClient('dev-auto-auth')

    const second = await ensureDevClientToken()

    // Handing back a token the daemon would reject is worse than handing back none.
    expect(second).not.toBe(first)
    expect(await readFile(devTokenFile, 'utf8')).toBe(second)
    expect(await authenticateClientToken(second)).not.toBeNull()
  })

  it('leaves paired devices alone when it re-mints', async () => {
    const grant = await issuePairingGrant('My iPhone')
    const paired = await exchangePairingGrant(grant.credential)
    await ensureDevClientToken()
    await rm(devTokenFile)
    await ensureDevClientToken()

    expect(await authenticateClientToken(paired?.token ?? '')).toEqual({
      kind: 'client',
      clientId: paired?.client.id,
      label: 'My iPhone',
    })
  })

  it('treats an unrelated token in the file as no credential at all', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(devTokenFile, 'pc_client_someone-else_deadbeef', 'utf8')

    const minted = await ensureDevClientToken()

    expect(minted).toMatch(/^pc_client_dev-auto-auth_/)
    expect((await accessSnapshot()).clients).toEqual([
      expect.objectContaining({ id: 'dev-auto-auth', label: 'Dev auto-auth' }),
    ])
  })

  it('treats an oversized access file as empty', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(file, Buffer.alloc(1_048_576 + 1, 0x20))

    expect(await accessSnapshot()).toEqual({ pairings: [], clients: [] })
  })
})
