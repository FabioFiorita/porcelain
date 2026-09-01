// @vitest-environment node
import { mkdir, mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { canonicalCheckoutPath } from './daemon-operations'

describe('canonicalCheckoutPath', () => {
  const roots: string[] = []

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it('gives a checkout and a lexical alias the same profile ownership key', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-checkout-alias-'))
    roots.push(root)
    const checkout = join(root, 'checkout')
    const alias = join(root, 'alias')
    await symlink(checkout, alias)

    // A dangling alias is retained until the checkout appears.
    expect(await canonicalCheckoutPath(alias)).toBe(alias)
    await mkdir(checkout)
    expect(await canonicalCheckoutPath(alias)).toBe(await canonicalCheckoutPath(checkout))
  })

  it('retains a missing path so a transient inventory race does not rewrite its identity', async () => {
    expect(await canonicalCheckoutPath('/definitely/missing/porcelain-checkout')).toBe(
      '/definitely/missing/porcelain-checkout',
    )
  })
})
