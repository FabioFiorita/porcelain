import { statSync, writeFileSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { displayAdminTokenPath, ensureAdminToken } from './admin-token'

const dir = join(tmpdir(), 'porcelain-admin-token-test')
const file = join(dir, 'admin-token')

beforeEach(async () => {
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('ensureAdminToken', () => {
  it('creates a fresh 64-hex-char token with 0600 perms when missing', async () => {
    const token = await ensureAdminToken(file)
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect(statSync(file).mode & 0o777).toBe(0o600)
  })

  it('reads back an existing token instead of minting a new one', async () => {
    writeFileSync(file, 'preexisting-token', { mode: 0o644 })
    expect(await ensureAdminToken(file)).toBe('preexisting-token')
    expect(statSync(file).mode & 0o777).toBe(0o600)
  })

  it('trims surrounding whitespace from an existing token', async () => {
    writeFileSync(file, '  padded-token\n')
    expect(await ensureAdminToken(file)).toBe('padded-token')
  })

  it('mints a fresh token when the file exists but is empty', async () => {
    writeFileSync(file, '   \n')
    expect(await ensureAdminToken(file)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('returns the same token on a second call', async () => {
    const first = await ensureAdminToken(file)
    expect(await ensureAdminToken(file)).toBe(first)
  })
})

describe('displayAdminTokenPath', () => {
  it('tilde-shortens paths under the current home', () => {
    const home = process.env.HOME ?? process.env.USERPROFILE
    if (home == null || home === '') return
    expect(displayAdminTokenPath(`${home}/.porcelain/admin-token`)).toBe('~/.porcelain/admin-token')
    expect(displayAdminTokenPath(`${home}/.porcelain-dev/admin-token`)).toBe(
      '~/.porcelain-dev/admin-token',
    )
  })

  it('leaves paths outside home unchanged', () => {
    expect(displayAdminTokenPath('/tmp/porcelain-e2e/admin-token')).toBe(
      '/tmp/porcelain-e2e/admin-token',
    )
  })
})
