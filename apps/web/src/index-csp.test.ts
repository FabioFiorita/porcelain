// @vitest-environment node
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('renderer Content Security Policy', () => {
  it('allows token-gated Canvas frames from LAN and HTTPS daemon origins', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')
    const policy = html.match(/content="(default-src[^"]+)"/)?.[1] ?? ''
    const frameSources = policy.match(/frame-src ([^;]+)/)?.[1]?.split(/\s+/)

    expect(frameSources).toEqual(["'self'", 'http:', 'https:'])
  })
})
