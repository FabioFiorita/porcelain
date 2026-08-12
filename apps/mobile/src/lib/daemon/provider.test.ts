import { describe, expect, it, vi } from 'vitest'

// The Remote feature store reaches into SecureStore and expo-crypto to persist and mint ids —
// neither exists outside a native runtime, and this suite runs under Vitest/jsdom like every
// other mobile pure-module test (see `apps/desktop/vitest.config.ts`). The endpoint walk itself
// is proved at its owning boundary in `features/remote/remote-session.test.ts`; what is left
// here is the provider's own `proceduresForChange` ownership.
vi.mock('expo-crypto', () => ({
  randomUUID: (): string => 'env-1',
}))
vi.mock('expo-secure-store', () => ({
  deleteItemAsync: vi.fn(async (): Promise<void> => {}),
  getItemAsync: vi.fn(async (): Promise<null> => null),
  setItemAsync: vi.fn(async (): Promise<void> => {}),
}))

// `provider.tsx` wires React Query's focus/online managers to real RN/Expo listeners at import
// time. The listener bodies never run in this suite (no test flips app-state or network state),
// so a no-op subscription is all either needs.
vi.mock('expo-network', () => ({
  addNetworkStateListener: vi.fn(() => ({ remove: vi.fn() })),
}))
vi.mock('react-native', () => ({
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
}))

const { proceduresForChange } = await import('./provider')

describe('proceduresForChange review.changed cutover (RVC-004)', () => {
  it('excludes reviewComments while keeping other Review procedure names', () => {
    const names = proceduresForChange({
      kind: 'review.changed',
      projectPath: '/synthetic/repo',
    })
    expect(names).not.toContain('reviewComments')
    expect(names).not.toContain('repoLayers')
    expect(names).toEqual(
      expect.arrayContaining([
        'featureView',
        'featureReading',
        'worktreeInbox',
        'loopEvidence',
        'loopEvidenceHtml',
        'reviewEvidenceDocs',
        'reviewEvidenceAssets',
        'reviewEvidenceAsset',
      ]),
    )
  })

  it('leaves the Git consequences of a Review change to the Git bridge (GIT-006)', () => {
    const names = proceduresForChange({ kind: 'review.changed', projectPath: '/synthetic/repo' })
    for (const git of ['gitFlow', 'gitRangeFlow', 'gitCommitFlow', 'diffReading']) {
      expect(names).not.toContain(git)
    }
  })

  it('leaves board.changed feature-owned (empty bulk list)', () => {
    expect(proceduresForChange({ kind: 'board.changed', projectPath: '/synthetic/repo' })).toEqual(
      [],
    )
  })
})

describe('proceduresForChange Files cutover (FIL-006)', () => {
  it('leaves Files identities to the typed bridge', () => {
    expect(
      proceduresForChange({ kind: 'files.scope-changed', projectPath: '/synthetic/repo' }),
    ).toEqual([])
    expect(
      proceduresForChange({
        kind: 'files.tree-changed',
        paths: ['src'],
        projectPath: '/synthetic/repo',
      }),
    ).toEqual([])
  })

  it('leaves content changes to the Files and Git bridges (GIT-006)', () => {
    expect(
      proceduresForChange({
        kind: 'files.content-changed',
        paths: ['src/main.ts'],
        projectPath: '/synthetic/repo',
      }),
    ).toEqual([])
  })
})

describe('proceduresForChange Git cutover (GIT-006)', () => {
  it('handles the working-tree signal as an explicit no-op the Git bridge owns', () => {
    expect(
      proceduresForChange({ kind: 'git.working-tree-changed', projectPath: '/synthetic/repo' }),
    ).toEqual([])
  })
})

describe('proceduresForChange Actions cutover (ACT-003)', () => {
  it('leaves actions.changed feature-owned (empty bulk list)', () => {
    expect(
      proceduresForChange({ kind: 'actions.changed', projectPath: '/synthetic/repo' }),
    ).toEqual([])
  })
})
