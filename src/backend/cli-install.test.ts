import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ensureCli } from './cli-install'

const dir = join(tmpdir(), 'porcelain-cli-install-test')
const home = join(dir, 'home')
const source = join(dir, 'porcelain.js')
const WRAPPER = '#!/bin/sh\nexec node "$(dirname "$0")/porcelain.js" "$@"\n'

beforeEach(async () => {
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
  writeFileSync(source, 'console.log("cli v1")\n')
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('ensureCli', () => {
  it('copies the bundle and writes a 0755 wrapper that execs it', async () => {
    const wrapper = await ensureCli(source, home)
    expect(wrapper).toBe(join(home, 'porcelain'))
    expect(readFileSync(join(home, 'porcelain.js'), 'utf8')).toBe('console.log("cli v1")\n')
    expect(readFileSync(wrapper, 'utf8')).toBe(WRAPPER)
    // 0755 = owner rwx, group/other rx; the low 9 permission bits are what matter.
    expect(statSync(wrapper).mode & 0o777).toBe(0o755)
  })

  it('refreshes the bundle and re-chmods a pre-existing non-executable wrapper', async () => {
    await mkdir(home, { recursive: true })
    writeFileSync(join(home, 'porcelain'), 'stale', { mode: 0o644 })
    writeFileSync(source, 'console.log("cli v2")\n')
    const wrapper = await ensureCli(source, home)
    expect(readFileSync(join(home, 'porcelain.js'), 'utf8')).toBe('console.log("cli v2")\n')
    expect(readFileSync(wrapper, 'utf8')).toBe(WRAPPER)
    expect(statSync(wrapper).mode & 0o777).toBe(0o755)
  })
})
