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

  it('adds worktree pins and hides on top of the baseline', () => {
    const resolved = resolveProfile(base, {
      ...emptyWorktreeProfile(),
      pinnedPaths: ['apps/mobile/src/screen.tsx'],
      hiddenPaths: ['apps/web'],
    })

    expect(resolved.pinnedPaths).toEqual(['README.md', 'apps/web', 'apps/mobile/src/screen.tsx'])
    expect(resolved.hiddenPaths).toEqual(['dist', 'pnpm-lock.yaml', 'apps/web'])
  })

  it('never repeats a path the baseline already carries', () => {
    const resolved = resolveProfile(base, {
      ...emptyWorktreeProfile(),
      pinnedPaths: ['README.md'],
      hiddenPaths: ['dist'],
    })

    expect(resolved.pinnedPaths).toEqual(base.pinnedPaths)
    expect(resolved.hiddenPaths).toEqual(base.hiddenPaths)
  })

  it('lets one worktree see a path the project hides', () => {
    const resolved = resolveProfile(base, {
      ...emptyWorktreeProfile(),
      unhiddenPaths: ['dist'],
    })

    expect(resolved.hiddenPaths).toEqual(['pnpm-lock.yaml'])
  })

  it('negates a hide the override itself declared', () => {
    const resolved = resolveProfile(base, {
      ...emptyWorktreeProfile(),
      hiddenPaths: ['apps/web'],
      unhiddenPaths: ['apps/web'],
    })

    expect(resolved.hiddenPaths).not.toContain('apps/web')
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
    expect(isEmptyWorktreeProfile({ ...emptyWorktreeProfile(), hiddenPaths: ['dist'] })).toBe(false)
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
      worktrees: {},
      layers: [],
      worktreeProfiles: {},
    })
  })

  it('keys worktree overrides by worktree id', () => {
    const parsed = privateProjectDocumentSchema.parse({
      worktreeProfiles: { 'wt-9': { hiddenPaths: ['apps/web'] } },
    })

    expect(parsed.worktreeProfiles['wt-9']).toEqual({
      pinnedPaths: [],
      hiddenPaths: ['apps/web'],
      unhiddenPaths: [],
      layers: null,
    })
  })
})

describe('stripPersonalProfileFields (ADR 0006)', () => {
  it('drops layers and worktree overrides from anything bound for a checkout', () => {
    const promoted = stripPersonalProfileFields({
      hiddenPaths: ['dist'],
      pinnedPaths: ['README.md'],
      worktrees: {},
      layers: [{ label: 'View', pattern: 'components/' }],
      worktreeProfiles: { 'wt-9': worktreeProfileSchema.parse({ hiddenPaths: ['x'] }) },
    })

    expect(promoted).toEqual({ hiddenPaths: ['dist'], pinnedPaths: ['README.md'], worktrees: {} })
    expect(promoted).not.toHaveProperty('layers')
    expect(promoted).not.toHaveProperty('worktreeProfiles')
  })
})
