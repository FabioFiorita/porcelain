import { describe, expect, it } from 'vitest'
import { ENVIRONMENT_NAME_MAX_LENGTH, projectsContractFixtures } from './projects.contract'
import { projectsProcedures } from './projects.procedures'

const expectedKinds = {
  openRepoPath: 'mutation',
  recentRepos: 'query',
  removeRecentRepo: 'mutation',
  removeHubProject: 'mutation',
  removeHubWorktree: 'mutation',
  browseDirs: 'query',
  hubInventory: 'query',
  environmentIdentity: 'query',
  renameEnvironment: 'mutation',
  createHubWorktree: 'mutation',
  listCanvases: 'query',
  readCanvas: 'query',
  mintCanvasAccessToken: 'mutation',
  promoteCanvas: 'mutation',
  promoteOverrides: 'mutation',
  listOverlay: 'query',
} as const

const expectedErrors = {
  openRepoPath: [
    'projects.not-found',
    'projects.not-a-directory',
    'projects.unavailable',
    'projects.dev-repo-forbidden',
  ],
  recentRepos: ['projects.unavailable'],
  removeRecentRepo: ['projects.unavailable'],
  removeHubProject: ['projects.not-found', 'projects.unavailable'],
  removeHubWorktree: [
    'projects.not-found',
    'projects.unavailable',
    'git.not-a-repository',
    'git.worktree-conflict',
  ],
  browseDirs: ['projects.not-found', 'projects.not-a-directory', 'projects.unavailable'],
  hubInventory: ['projects.unavailable'],
  environmentIdentity: ['projects.unavailable'],
  renameEnvironment: ['projects.unavailable'],
  createHubWorktree: [
    'projects.not-found',
    'projects.unavailable',
    'git.not-a-repository',
    'git.branch-already-exists',
    'git.worktree-conflict',
  ],
  listCanvases: ['canvas.unavailable'],
  readCanvas: ['canvas.not-found', 'canvas.unavailable'],
  mintCanvasAccessToken: ['canvas.not-found', 'canvas.unavailable'],
  promoteCanvas: ['canvas.not-found', 'canvas.unavailable', 'projects.overlay-target-invalid'],
  promoteOverrides: ['projects.unavailable', 'projects.overlay-target-invalid'],
  listOverlay: ['projects.unavailable'],
} as const

const invalidInputs = {
  openRepoPath: 42,
  recentRepos: { includeWorktrees: 'true' },
  removeRecentRepo: 42,
  removeHubProject: 42,
  removeHubWorktree: { projectId: 'proj-alpha' },
  browseDirs: 42,
  hubInventory: {},
  environmentIdentity: {},
  // 61 characters — one past ENVIRONMENT_NAME_MAX_LENGTH, rejected rather than trimmed.
  renameEnvironment: { name: 'n'.repeat(ENVIRONMENT_NAME_MAX_LENGTH + 1) },
  createHubWorktree: { projectId: 'proj-alpha', branch: '' },
  listCanvases: { projectId: '' },
  readCanvas: { projectId: 'proj-alpha' },
  mintCanvasAccessToken: { projectId: 'proj-alpha' },
  // Every promotion needs an explicit target checkout — a missing `path` is a
  // rejected request, never a guessed one.
  promoteCanvas: { projectId: 'proj-alpha', canvasId: 'canvas-intent' },
  promoteOverrides: { projectId: 'proj-alpha' },
  listOverlay: { path: '' },
} as const

const invalidOutputs = {
  openRepoPath: { path: '/synthetic/projects/alpha', name: 42 },
  recentRepos: [{ path: '/synthetic/projects/alpha', name: 42 }],
  removeRecentRepo: null,
  removeHubProject: null,
  removeHubWorktree: null,
  browseDirs: {
    path: '/synthetic/projects',
    parent: '/synthetic',
    entries: [{ name: 'alpha', path: '/synthetic/projects/alpha', isRepo: 'true' }],
  },
  hubInventory: { environment: { id: 'env' }, projects: [] },
  environmentIdentity: { id: 'env-synthetic', name: '', host: '', platform: 'linux', arch: 'x64' },
  renameEnvironment: { id: 'env-synthetic', name: '', host: '', platform: 'linux', arch: 'x64' },
  createHubWorktree: { id: 'wt', projectId: 'proj', path: '/x', name: 'x', branch: 'x' },
  listCanvases: [{ id: 'canvas-a', title: 'Intent', kind: 'pdf' }],
  readCanvas: { record: { id: 'canvas-a' }, content: 42 },
  mintCanvasAccessToken: { token: 42 },
  promoteCanvas: { record: { id: 'canvas-a' }, bundlePath: 42 },
  promoteOverrides: { hiddenPaths: ['a'], pinnedPaths: [], worktrees: { main: {} } },
  listOverlay: { path: '/x', present: 'yes', canvases: [], overrides: null },
} as const

describe('Projects procedure contracts', () => {
  it('declares every Projects procedure with its router kind', () => {
    expect(Object.keys(projectsProcedures).sort()).toEqual(Object.keys(expectedKinds).sort())
    for (const [name, kind] of Object.entries(expectedKinds)) {
      expect(projectsProcedures[name as keyof typeof projectsProcedures].kind).toBe(kind)
    }
  })

  it('declares the exact typed Project failures for each procedure', () => {
    for (const [name, errors] of Object.entries(expectedErrors)) {
      expect(projectsProcedures[name as keyof typeof projectsProcedures].errors).toEqual(errors)
    }
  })

  for (const name of Object.keys(projectsProcedures) as Array<keyof typeof projectsProcedures>) {
    it(`accepts valid ${name} input and output fixtures`, () => {
      const fixture = projectsContractFixtures[name]
      const procedure = projectsProcedures[name]
      expect(procedure.input.safeParse(fixture.input).success).toBe(true)
      expect(procedure.output.safeParse(fixture.output).success).toBe(true)
    })

    it(`rejects invalid ${name} input and output fixtures`, () => {
      const procedure = projectsProcedures[name]
      expect(procedure.input.safeParse(invalidInputs[name]).success).toBe(false)
      expect(procedure.output.safeParse(invalidOutputs[name]).success).toBe(false)
    })
  }

  it('preserves omitted and present recentRepos includeWorktrees values', () => {
    const input = projectsProcedures.recentRepos.input
    expect(input.safeParse(undefined).success).toBe(true)
    expect(input.safeParse({}).success).toBe(true)
    expect(input.parse({})).toEqual({ includeWorktrees: false })
    expect(input.safeParse({ includeWorktrees: false }).success).toBe(true)
    expect(input.safeParse({ includeWorktrees: true }).success).toBe(true)
  })

  it('accepts nullable and non-null browse roots and nullable output parents', () => {
    const procedure = projectsProcedures.browseDirs
    expect(procedure.input.safeParse(null).success).toBe(true)
    expect(procedure.input.safeParse('/synthetic/projects').success).toBe(true)
    expect(
      procedure.output.safeParse({
        path: '/',
        parent: null,
        entries: [],
      }).success,
    ).toBe(true)
  })

  it('rejects unknown fields at the Projects wire boundary', () => {
    expect(
      projectsProcedures.openRepoPath.output.safeParse({
        ...projectsContractFixtures.openRepoPath.output,
        extra: true,
      }).success,
    ).toBe(false)
    expect(
      projectsProcedures.recentRepos.input.safeParse({ includeWorktrees: true, extra: false })
        .success,
    ).toBe(false)
    expect(
      projectsProcedures.browseDirs.output.safeParse({
        ...projectsContractFixtures.browseDirs.output,
        entries: [
          {
            ...projectsContractFixtures.browseDirs.output.entries[0],
            extra: true,
          },
        ],
      }).success,
    ).toBe(false)
  })

  it('clears a nickname with an empty name and bounds a long one', () => {
    const input = projectsProcedures.renameEnvironment.input
    // Clearing is a legal rename: the daemon answers with its machine-derived name.
    expect(input.safeParse({ name: '' }).success).toBe(true)
    expect(input.safeParse({ name: '   ' }).success).toBe(true)
    expect(input.safeParse({ name: 'n'.repeat(ENVIRONMENT_NAME_MAX_LENGTH) }).success).toBe(true)
    expect(input.safeParse({ name: 'n'.repeat(ENVIRONMENT_NAME_MAX_LENGTH + 1) }).success).toBe(
      false,
    )
    // The ANNOUNCED name is never empty, whatever the human typed.
    expect(
      projectsProcedures.renameEnvironment.output.safeParse({
        ...projectsContractFixtures.environmentIdentity.output,
        name: '',
      }).success,
    ).toBe(false)
  })
})
