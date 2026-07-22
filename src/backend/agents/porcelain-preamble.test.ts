import { describe, expect, it } from 'vitest'
import { PORCELAIN_PREAMBLE, wrapPorcelainContext } from './porcelain-preamble'

describe('PORCELAIN_PREAMBLE', () => {
  it('tells agents to drive the porcelain CLI', () => {
    expect(PORCELAIN_PREAMBLE).toContain('~/.porcelain/porcelain')
    expect(PORCELAIN_PREAMBLE).toContain('review set')
  })

  // Headless Agent-tab turns end when the agent stops — fire-and-forget monitors die
  // with the process (v0.39.1 release babysit miss). Keep the blocking-watch rule.
  it('forbids fire-and-forget monitors for long CI watches', () => {
    expect(PORCELAIN_PREAMBLE).toMatch(/gh run watch/i)
    expect(PORCELAIN_PREAMBLE).toMatch(/fire-and-forget|monitor\/background/i)
    expect(PORCELAIN_PREAMBLE).toMatch(/SAME turn/i)
  })

  it('wrapPorcelainContext wraps only the first message of a new thread', () => {
    const wrapped = wrapPorcelainContext('fix the bug')
    expect(wrapped).toContain('<porcelain-context>')
    expect(wrapped).toContain(PORCELAIN_PREAMBLE)
    expect(wrapped).toContain('fix the bug')
  })
})
