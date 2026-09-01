import { describe, expect, it } from 'vitest'
import { projectOverridePath } from './project-overrides'

describe('projectOverridePath', () => {
  it('normalizes absolute and relative paths to repo-relative POSIX paths', () => {
    expect(projectOverridePath('/repo', '/repo/src/a.ts')).toBe('src/a.ts')
    expect(projectOverridePath('/repo', './src/a.ts')).toBe('src/a.ts')
    expect(projectOverridePath('/repo', 'src/a.ts')).toBe('src/a.ts')
    expect(projectOverridePath('/repo', '/repo')).toBe('')
  })

  it('rejects absolute paths outside the repository', () => {
    expect(() => projectOverridePath('/repo', '/other/a.ts')).toThrow(/inside the repo/)
  })

  it('rejects traversal-shaped relative paths instead of persisting them', () => {
    expect(() => projectOverridePath('/repo', '../outside.txt')).toThrow(/normalized path/)
    expect(() => projectOverridePath('/repo', 'src/../../outside.txt')).toThrow(/normalized path/)
    expect(() => projectOverridePath('/repo', 'src/./a.ts')).toThrow(/normalized path/)
    expect(() => projectOverridePath('/repo', '/repo/../../outside.txt')).toThrow(/normalized path/)
  })
})
