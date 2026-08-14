import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createValidatingDaemonMock } from '@porcelain/client-runtime/testing/daemon-mock'
import { publicErrorSchema } from '@porcelain/contracts'
import {
  projectDataContractFixtures,
  projectDataProcedures,
} from '@porcelain/contracts/project-data'
import { mutableFixture } from '@porcelain/contracts/testing'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { projectDataMutations } from './project-data-mutations'
import {
  projectDataDispositionsQuery,
  projectDataLayersQuery,
  projectDataNotesQuery,
  projectDataVisibilityQuery,
} from './project-data-queries'

const fixtures = projectDataContractFixtures
const OTHER = '/synthetic/other'

const projectDataCatalog = {
  procedures: projectDataProcedures,
  notification: z.never(),
  publicError: publicErrorSchema,
}

describe('projectDataMutations', () => {
  it('binds each definition to the live catalog procedure name', () => {
    expect(projectDataMutations.setRepoNotes.procedure).toBe(projectDataProcedures.setRepoNotes)
    expect(projectDataMutations.setRepoNotes.procedureName).toBe('setRepoNotes')

    expect(projectDataMutations.setRepoLayers.procedure).toBe(projectDataProcedures.setRepoLayers)
    expect(projectDataMutations.setRepoLayers.procedureName).toBe('setRepoLayers')

    expect(projectDataMutations.setCompanionGitVisibility.procedure).toBe(
      projectDataProcedures.setCompanionGitVisibility,
    )
    expect(projectDataMutations.setCompanionGitVisibility.procedureName).toBe(
      'setCompanionGitVisibility',
    )

    expect(projectDataMutations.setCompanionDisposition.procedure).toBe(
      projectDataProcedures.setCompanionDisposition,
    )
    expect(projectDataMutations.setCompanionDisposition.procedureName).toBe(
      'setCompanionDisposition',
    )
  })

  it('affects only the declared Project Data identities for the input repoPath', () => {
    const path = fixtures.setRepoNotes.input.repoPath
    expect(projectDataMutations.setRepoNotes.affectedQueries(fixtures.setRepoNotes.input)).toEqual([
      projectDataNotesQuery(path),
    ])
    expect(
      projectDataMutations.setRepoLayers.affectedQueries(
        mutableFixture(fixtures.setRepoLayers.input),
      ),
    ).toEqual([projectDataLayersQuery(path)])
    expect(
      projectDataMutations.setCompanionGitVisibility.affectedQueries(
        fixtures.setCompanionGitVisibility.input,
      ),
    ).toEqual([projectDataVisibilityQuery(path), projectDataDispositionsQuery(path)])
    expect(
      projectDataMutations.setCompanionDisposition.affectedQueries(
        fixtures.setCompanionDisposition.input,
      ),
    ).toEqual([projectDataDispositionsQuery(path), projectDataVisibilityQuery(path)])

    expect(
      projectDataMutations.setRepoNotes.affectedQueries(fixtures.setRepoNotes.input),
    ).not.toEqual([projectDataNotesQuery(OTHER)])
  })

  it('requires an authoritative refetch and has no optimistic field', () => {
    const definitions = [
      projectDataMutations.setRepoNotes,
      projectDataMutations.setRepoLayers,
      projectDataMutations.setCompanionGitVisibility,
      projectDataMutations.setCompanionDisposition,
    ]
    for (const definition of definitions) {
      expect(definition.requiresAuthoritativeRefetch).toBe(true)
      expect(Object.hasOwn(definition, 'optimistic')).toBe(false)
    }
  })

  it('dispatches the four bound procedures through the validating daemon mock', async () => {
    const daemon = createValidatingDaemonMock(projectDataCatalog, {
      setRepoNotes: () => ({ ok: true, value: fixtures.setRepoNotes.output }),
      setRepoLayers: () => ({ ok: true, value: fixtures.setRepoLayers.output }),
      setCompanionGitVisibility: () => ({
        ok: true,
        value: fixtures.setCompanionGitVisibility.output,
      }),
      setCompanionDisposition: () => ({
        ok: true,
        value: fixtures.setCompanionDisposition.output,
      }),
    })

    const outcomes = await Promise.all([
      daemon.dispatch({
        procedure: projectDataMutations.setRepoNotes.procedureName,
        kind: projectDataMutations.setRepoNotes.procedure.kind,
        input: fixtures.setRepoNotes.input,
      }),
      daemon.dispatch({
        procedure: projectDataMutations.setRepoLayers.procedureName,
        kind: projectDataMutations.setRepoLayers.procedure.kind,
        input: fixtures.setRepoLayers.input,
      }),
      daemon.dispatch({
        procedure: projectDataMutations.setCompanionGitVisibility.procedureName,
        kind: projectDataMutations.setCompanionGitVisibility.procedure.kind,
        input: fixtures.setCompanionGitVisibility.input,
      }),
      daemon.dispatch({
        procedure: projectDataMutations.setCompanionDisposition.procedureName,
        kind: projectDataMutations.setCompanionDisposition.procedure.kind,
        input: fixtures.setCompanionDisposition.input,
      }),
    ])

    expect(outcomes.map((outcome) => outcome.ok)).toEqual([true, true, true, true])
    expect(daemon.requests().map((request) => request.procedure)).toEqual([
      'setRepoNotes',
      'setRepoLayers',
      'setCompanionGitVisibility',
      'setCompanionDisposition',
    ])
  })

  it('does not import git, review, or trpc', () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'project-data-mutations.ts'),
      'utf8',
    )
    expect(source).not.toMatch(/from ['"][^'"]*\/(git|review)['"]/)
    expect(source).not.toMatch(/\btrpc\b/)
  })
})
