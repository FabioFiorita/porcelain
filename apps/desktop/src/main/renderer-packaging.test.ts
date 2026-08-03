import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const webViteConfig = resolve(__dirname, '../../../web/vite.config.ts')
const builtIndex = resolve(__dirname, '../../out/renderer/index.html')

describe('renderer packaging (file:// safe base)', () => {
  it("apps/web vite sets base: './'", () => {
    expect(readFileSync(webViteConfig, 'utf8')).toMatch(/\bbase:\s*['"]\.\/['"]/)
  })

  it('built index.html uses relative asset URLs when dist is present', () => {
    if (!existsSync(builtIndex)) return
    const html = readFileSync(builtIndex, 'utf8')
    const refs = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map((m) => m[1] ?? '')
    expect(refs.some((h) => h.includes('assets/'))).toBe(true)
    for (const href of refs) {
      if (href.startsWith('http') || href.startsWith('data:')) continue
      expect(href.startsWith('/'), `absolute root URL breaks file://: ${href}`).toBe(false)
    }
  })
})
