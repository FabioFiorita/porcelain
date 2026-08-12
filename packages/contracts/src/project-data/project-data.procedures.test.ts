import { describe, expect, it } from 'vitest'
import {
  COMPANION_DISPOSITION_VALUES,
  channelDispositionSchema,
  projectDataContractFixtures,
} from './project-data.contract'
import { projectDataProcedures } from './project-data.procedures'

const expectedKinds = {
  repoNotes: 'query',
  setRepoNotes: 'mutation',
  companionDispositions: 'query',
  companionGitVisibility: 'query',
  setCompanionGitVisibility: 'mutation',
  setCompanionDisposition: 'mutation',
  repoLayers: 'query',
  setRepoLayers: 'mutation',
} as const

const invalidInputs = {
  repoNotes: 12,
  setRepoNotes: { repoPath: '/synthetic/repo' },
  companionDispositions: { repoPath: '/synthetic/repo' },
  companionGitVisibility: null,
  setCompanionGitVisibility: { repoPath: '/synthetic/repo', hidden: 'yes' },
  setCompanionDisposition: { repoPath: '/synthetic/repo', key: '', disposition: 'local' },
  repoLayers: 42,
  setRepoLayers: { repoPath: '/synthetic/repo', layers: [] },
} as const

const invalidOutputs = {
  repoNotes: null,
  setRepoNotes: 'written',
  companionDispositions: [
    { ...projectDataContractFixtures.companionDispositions.output[0], disposition: 'team' },
  ],
  companionGitVisibility: { hidden: 'true' },
  setCompanionGitVisibility: {},
  setCompanionDisposition: { untracked: '.porcelain/board.json', revealed: false },
  repoLayers: { layers: [{ label: 'Docs', pattern: 42 }], custom: true },
  setRepoLayers: null,
} as const

describe('Project Data procedure contracts', () => {
  it('declares exactly eight procedures with their router kinds', () => {
    expect(Object.keys(projectDataProcedures).sort()).toEqual(Object.keys(expectedKinds).sort())
    for (const [name, kind] of Object.entries(expectedKinds)) {
      expect(projectDataProcedures[name as keyof typeof projectDataProcedures].kind).toBe(kind)
    }
  })

  for (const name of Object.keys(projectDataProcedures) as Array<
    keyof typeof projectDataProcedures
  >) {
    it(`accepts valid ${name} input and output fixtures`, () => {
      const fixture = projectDataContractFixtures[name]
      const procedure = projectDataProcedures[name]
      expect(procedure.input.safeParse(fixture.input).success).toBe(true)
      expect(procedure.output.safeParse(fixture.output).success).toBe(true)
    })

    it(`rejects invalid ${name} input and output fixtures`, () => {
      const procedure = projectDataProcedures[name]
      expect(procedure.input.safeParse(invalidInputs[name]).success).toBe(false)
      expect(procedure.output.safeParse(invalidOutputs[name]).success).toBe(false)
    })
  }

  it('reads missing notes as the empty string rather than null', () => {
    expect(projectDataProcedures.repoNotes.output.parse('')).toBe('')
    expect(projectDataProcedures.repoNotes.output.safeParse(null).success).toBe(false)
    expect(
      projectDataProcedures.setRepoNotes.input.safeParse({ repoPath: '/synthetic/repo', notes: '' })
        .success,
    ).toBe(true)
    expect(
      projectDataProcedures.setRepoNotes.input.safeParse({
        repoPath: '/synthetic/repo',
        notes: null,
      }).success,
    ).toBe(false)
  })

  it('leaves repository paths and notes unbounded', () => {
    const long = 'x'.repeat(5000)
    expect(projectDataProcedures.repoNotes.input.safeParse('').success).toBe(true)
    expect(
      projectDataProcedures.setRepoNotes.input.safeParse({ repoPath: '', notes: long }).success,
    ).toBe(true)
  })

  it('accepts both dispositions and any channel key the daemon reports', () => {
    for (const disposition of COMPANION_DISPOSITION_VALUES) {
      expect(
        channelDispositionSchema.safeParse({
          key: 'future-channel',
          label: 'Future',
          hint: 'Not yet known here',
          disposition,
          trackedPaths: [],
        }).success,
      ).toBe(true)
      expect(
        projectDataProcedures.setCompanionDisposition.input.safeParse({
          repoPath: '/synthetic/repo',
          key: 'future-channel',
          disposition,
        }).success,
      ).toBe(true)
    }
  })

  it('requires a non-empty disposition key', () => {
    expect(
      projectDataProcedures.setCompanionDisposition.input.safeParse({
        repoPath: '/synthetic/repo',
        key: '',
        disposition: 'shared',
      }).success,
    ).toBe(false)
  })

  it('reports tracked paths, visibility changes, and untracked/revealed results', () => {
    expect(
      projectDataProcedures.companionDispositions.output.parse([
        {
          key: 'notes',
          label: 'Notes',
          hint: 'Repository notes',
          disposition: 'shared',
          trackedPaths: ['.porcelain/notes.md'],
        },
      ])[0]?.trackedPaths,
    ).toEqual(['.porcelain/notes.md'])
    expect(projectDataProcedures.companionGitVisibility.output.parse({ hidden: false })).toEqual({
      hidden: false,
    })
    expect(
      projectDataProcedures.setCompanionGitVisibility.output.parse({ changed: false }),
    ).toEqual({ changed: false })
    expect(
      projectDataProcedures.setCompanionDisposition.output.parse({
        untracked: [],
        revealed: true,
      }),
    ).toEqual({ untracked: [], revealed: true })
  })

  it('rejects unknown fields at every object boundary', () => {
    expect(
      projectDataProcedures.setRepoNotes.input.safeParse({
        ...projectDataContractFixtures.setRepoNotes.input,
        force: true,
      }).success,
    ).toBe(false)
    expect(
      projectDataProcedures.companionDispositions.output.safeParse([
        {
          ...projectDataContractFixtures.companionDispositions.output[0],
          defaultDisposition: 'local',
        },
      ]).success,
    ).toBe(false)
    expect(
      projectDataProcedures.companionGitVisibility.output.safeParse({ hidden: true, path: '/x' })
        .success,
    ).toBe(false)
    expect(
      projectDataProcedures.setCompanionGitVisibility.input.safeParse({
        ...projectDataContractFixtures.setCompanionGitVisibility.input,
        key: 'board',
      }).success,
    ).toBe(false)
    expect(
      projectDataProcedures.setCompanionDisposition.output.safeParse({
        untracked: [],
        revealed: false,
        hidden: false,
      }).success,
    ).toBe(false)
  })

  it('keeps the notes mutation result void', () => {
    expect(projectDataProcedures.setRepoNotes.output.safeParse(undefined).success).toBe(true)
  })

  it('trims layer labels, accepts a null clear, and rejects blank labels, empty arrays, and invalid regexes', () => {
    expect(
      projectDataProcedures.setRepoLayers.input.parse({
        repoPath: '/synthetic/repo',
        layers: [{ label: ' Docs ', pattern: '(^|/)docs/' }],
      }),
    ).toEqual({ repoPath: '/synthetic/repo', layers: [{ label: 'Docs', pattern: '(^|/)docs/' }] })
    expect(
      projectDataProcedures.setRepoLayers.input.safeParse({
        repoPath: '/synthetic/repo',
        layers: null,
      }).success,
    ).toBe(true)
    expect(
      projectDataProcedures.setRepoLayers.input.safeParse({
        repoPath: '/synthetic/repo',
        layers: [{ label: '   ', pattern: 'docs/' }],
      }).success,
    ).toBe(false)
    expect(
      projectDataProcedures.setRepoLayers.input.safeParse({
        repoPath: '/synthetic/repo',
        layers: [{ label: 'Docs', pattern: '[' }],
      }).success,
    ).toBe(false)
    expect(
      projectDataProcedures.setRepoLayers.input.safeParse({
        repoPath: '/synthetic/repo',
        layers: [],
      }).success,
    ).toBe(false)
  })

  it('rejects extra keys on layer write input and layer read output', () => {
    expect(
      projectDataProcedures.setRepoLayers.input.safeParse({
        ...projectDataContractFixtures.setRepoLayers.input,
        reset: true,
      }).success,
    ).toBe(false)
    expect(
      projectDataProcedures.repoLayers.output.safeParse({
        ...projectDataContractFixtures.repoLayers.output,
        layers: [{ ...projectDataContractFixtures.repoLayers.output.layers[0], extra: true }],
      }).success,
    ).toBe(false)
  })
})
