import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { daemonVersion } from './daemon-version'

describe('daemonVersion', () => {
  it('reports the package.json version baked in at build time', () => {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json')
    const { version } = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string }
    expect(daemonVersion()).toBe(version)
  })

  it('is a non-empty string', () => {
    expect(daemonVersion()).toBeTruthy()
    expect(typeof daemonVersion()).toBe('string')
  })
})
