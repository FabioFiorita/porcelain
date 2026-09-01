import { describe, expect, it } from 'vitest'
import {
  privateProjectDocumentSchema,
  stripPersonalProfileFields,
} from './projects/private-document.contract'
import {
  emptyWorktreeProfile,
  isEmptyWorktreeProfile,
  type ResolvedProfile,
  resolveProfile,
  worktreeProfileSchema,
} from './worktree-profile'

const base: ResolvedProfile = {
  pinnedPaths: ['README.md', 'apps/web'],
  hiddenPaths: ['dist', 'pnpm-lock.yaml'],
  layers: [{ label: 'View', pattern: 'components/' }],
}

describe('resolveProfile', () => {
  it('returns the project baseline when a worktree has no override', () => {
    expect(resolveProfile(base, null)).toEqual(base)
  })

  it('does not alias the baseline it was handed', () => {
    const resolved = resolveProfile(base, null)
    expect(resolved).not.toBe(base)
  })

  it('always takes pins and hides from the project baseline', () => {
    const resolved = resolveProfile(base, { layers: [] })
    expect(resolved.pinnedPaths).toEqual(base.pinnedPaths)
    expect(resolved.hiddenPaths).toEqual(base.hiddenPaths)
  })

  it('replaces layer order wholesale rather than interleaving two stories', () => {
    const resolved = resolveProfile(base, {
      ...emptyWorktreeProfile(),
      layers: [{ label: 'Screen', pattern: 'screens/' }],
    })

    expect(resolved.layers).toEqual([{ label: 'Screen', pattern: 'screens/' }])
  })

  it('distinguishes "inherit the project order" (null) from "do not" (empty)', () => {
    expect(resolveProfile(base, emptyWorktreeProfile()).layers).toEqual(base.layers)
    expect(resolveProfile(base, { ...emptyWorktreeProfile(), layers: [] }).layers).toEqual([])
  })
})

describe('isEmptyWorktreeProfile', () => {
  it('treats a null and an all-defaults override the same', () => {
    expect(isEmptyWorktreeProfile(null)).toBe(true)
    expect(isEmptyWorktreeProfile(emptyWorktreeProfile())).toBe(true)
  })

  it('is false once the override says anything, including "no layers here"', () => {
    expect(isEmptyWorktreeProfile({ ...emptyWorktreeProfile(), layers: [] })).toBe(false)
  })
})

describe('privateProjectDocumentSchema', () => {
  it('parses a document written before profiles existed', () => {
    const parsed = privateProjectDocumentSchema.parse({
      hiddenPaths: ['dist'],
      pinnedPaths: [],
      worktrees: {},
    })

    expect(parsed.layers).toEqual([])
    expect(parsed.worktreeProfiles).toEqual({})
  })

  it('parses a document that dropped every key', () => {
    expect(privateProjectDocumentSchema.parse({})).toEqual({
      hiddenPaths: [],
      pinnedPaths: [],
      layers: [],
      worktreeProfiles: {},
    })
  })

  it('discards legacy worktree path fields while retaining its story layers', () => {
    const parsed = privateProjectDocumentSchema.parse({
      worktreeProfiles: {
        'wt-9': {
          pinnedPaths: ['README.md'],
          hiddenPaths: ['apps/web'],
          unhiddenPaths: ['dist'],
          layers: [{ label: 'View', pattern: 'components/' }],
        },
      },
    })

    expect(parsed.worktreeProfiles['wt-9']).toEqual({
      layers: [{ label: 'View', pattern: 'components/' }],
    })
  })
})

describe('stripPersonalProfileFields', () => {
  it('drops layers and worktree overrides from anything bound for a checkout', () => {
    const promoted = stripPersonalProfileFields({
      hiddenPaths: ['dist'],
      pinnedPaths: ['README.md'],
      layers: [{ label: 'View', pattern: 'components/' }],
      worktreeProfiles: { 'wt-9': worktreeProfileSchema.parse({ layers: [] }) },
    })

    expect(promoted).toEqual({ hiddenPaths: ['dist'], pinnedPaths: ['README.md'] })
    expect(promoted).not.toHaveProperty('layers')
    expect(promoted).not.toHaveProperty('worktreeProfiles')
  })
})
