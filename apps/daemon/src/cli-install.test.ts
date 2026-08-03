import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ensureCli } from './cli-install'

const dir = join(tmpdir(), 'porcelain-cli-install-test')
const home = join(dir, 'home')
// Mirror out/main layout: cli/porcelain.js (+ optional chunks/)
const main = join(dir, 'main')
const source = join(main, 'cli', 'porcelain.js')
const chunksSrc = join(main, 'chunks')
const WRAPPER = '#!/bin/sh\nexec node "$(dirname "$0")/cli/porcelain.js" "$@"\n'

beforeEach(async () => {
  await rm(dir, { recursive: true, force: true })
  await mkdir(join(main, 'cli'), { recursive: true })
  // Default: single-file CLI (esbuild). Chunks suite recreates chunks/ as needed.
  writeFileSync(source, 'console.log("cli v1")\n')
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('ensureCli', () => {
  it('installs cli/ and a 0755 wrapper that execs cli/porcelain.js (single-file)', async () => {
    const wrapper = await ensureCli(source, home)
    expect(wrapper).toBe(join(home, 'porcelain'))
    expect(readFileSync(join(home, 'cli', 'porcelain.js'), 'utf8')).toContain('cli v1')
    expect(readFileSync(wrapper, 'utf8')).toBe(WRAPPER)
    expect(statSync(wrapper).mode & 0o777).toBe(0o755)
  })

  it('copies chunks when the build still emits them', async () => {
    await mkdir(chunksSrc, { recursive: true })
    writeFileSync(source, 'require("../chunks/porcelain-home-test.js"); console.log("cli v1")\n')
    writeFileSync(join(chunksSrc, 'porcelain-home-test.js'), 'module.exports = {}\n')
    await ensureCli(source, home)
    expect(readFileSync(join(home, 'chunks', 'porcelain-home-test.js'), 'utf8')).toContain(
      'module.exports',
    )
  })

  it('refreshes the bundle and re-chmods a pre-existing non-executable wrapper', async () => {
    await mkdir(home, { recursive: true })
    writeFileSync(join(home, 'porcelain'), 'stale', { mode: 0o644 })
    writeFileSync(source, 'console.log("cli v2")\n')
    const wrapper = await ensureCli(source, home)
    expect(readFileSync(join(home, 'cli', 'porcelain.js'), 'utf8')).toContain('cli v2')
    expect(readFileSync(wrapper, 'utf8')).toBe(WRAPPER)
    expect(statSync(wrapper).mode & 0o777).toBe(0o755)
  })

  it('removes an obsolete flat porcelain.js', async () => {
    await mkdir(home, { recursive: true })
    writeFileSync(join(home, 'porcelain.js'), 'stale-flat')
    await ensureCli(source, home)
    expect(() => readFileSync(join(home, 'porcelain.js'))).toThrow()
    expect(readFileSync(join(home, 'cli', 'porcelain.js'), 'utf8')).toContain('cli v1')
  })

  it('drops stale install chunks when the new CLI is single-file', async () => {
    await mkdir(join(home, 'chunks'), { recursive: true })
    writeFileSync(join(home, 'chunks', 'old.js'), 'stale')
    await ensureCli(source, home)
    expect(() => readFileSync(join(home, 'chunks', 'old.js'))).toThrow()
  })
})
