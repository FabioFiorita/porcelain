import { statSync, writeFileSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ensureDaemonToken } from './token-file'

const dir = join(tmpdir(), 'porcelain-token-file-test')
const file = join(dir, 'daemon-token')

beforeEach(async () => {
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('ensureDaemonToken', () => {
  it('creates a fresh 64-hex-char token with 0600 perms when missing', async () => {
    const token = await ensureDaemonToken(file)
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    // 0600 = owner read/write only; the low 9 permission bits are what matter.
    expect(statSync(file).mode & 0o777).toBe(0o600)
  })

  it('reads back an existing token instead of minting a new one', async () => {
    writeFileSync(file, 'preexisting-token')
    expect(await ensureDaemonToken(file)).toBe('preexisting-token')
  })

  it('trims surrounding whitespace from an existing token', async () => {
    writeFileSync(file, '  padded-token\n')
    expect(await ensureDaemonToken(file)).toBe('padded-token')
  })

  it('mints a fresh token when the file exists but is empty/whitespace', async () => {
    writeFileSync(file, '   \n')
    expect(await ensureDaemonToken(file)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('returns the same token on a second call', async () => {
    const first = await ensureDaemonToken(file)
    expect(await ensureDaemonToken(file)).toBe(first)
  })
})
