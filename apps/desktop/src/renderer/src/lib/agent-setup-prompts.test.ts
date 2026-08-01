import { describe, expect, it } from 'vitest'
import { layersSetupPrompt, scopeSetupPrompt } from './agent-setup-prompts'

describe('layersSetupPrompt', () => {
  it('asks for inspect → propose → layers set → confirm', () => {
    const p = layersSetupPrompt()
    expect(p).toContain('Inspect the repo layout')
    expect(p).toContain('layers set')
    expect(p).toContain('layers get')
    expect(p).toContain('Docs + Agents')
    expect(p).toContain('entry-point')
  })
})

describe('scopeSetupPrompt', () => {
  it('asks for hide/pin via the scope CLI', () => {
    const p = scopeSetupPrompt()
    expect(p).toContain('scope hide')
    expect(p).toContain('scope pin')
    expect(p).toContain('scope list')
    expect(p).toContain('monorepo')
  })
})
