import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Frosted-glass menu Content used to force every data-[variant=destructive] item to
// text-accent-foreground with !important — so "Delete permanently", file Delete, board
// Delete, and Clear review all looked neutral despite variant="destructive" on the item.
// Guard against that if `shadcn add dropdown-menu` / `context-menu` overwrites these files.
const here = dirname(fileURLToPath(import.meta.url))

const badAccentForce = 'data-[variant=destructive]:text-accent-foreground!'
const goodDestructive = 'data-[variant=destructive]:text-destructive!'

describe.each(['context-menu.tsx', 'dropdown-menu.tsx'] as const)('%s destructive styling', (file) => {
  const src = readFileSync(join(here, file), 'utf8')

  it('keeps destructive items red (does not force accent-foreground)', () => {
    expect(src).not.toContain(badAccentForce)
    expect(src).toContain(goodDestructive)
  })
})
