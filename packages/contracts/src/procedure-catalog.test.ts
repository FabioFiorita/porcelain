import { describe, expect, it } from 'vitest'
import { actionsProcedures } from './actions'
import { boardLiveCatalogProcedures, boardProcedures } from './board/board.procedures'
import { filesProcedures } from './files'
import { gitProcedures } from './git'
import { procedureCatalog } from './procedure-catalog'
import { projectDataProcedures } from './project-data'
import { projectsProcedures } from './projects'
import { remoteProcedures } from './remote'
import { reviewProcedures } from './review'
import { searchProcedures } from './search'
import { terminalProcedures } from './terminal'

/** The ten domain records that currently compose the 113-name live catalog. */
const domainProcedures = {
  remote: remoteProcedures,
  projects: projectsProcedures,
  files: filesProcedures,
  search: searchProcedures,
  git: gitProcedures,
  review: reviewProcedures,
  board: boardLiveCatalogProcedures,
  actions: actionsProcedures,
  terminal: terminalProcedures,
  'project-data': projectDataProcedures,
} as const

const PROCEDURE_COUNT = 113

describe('procedure catalog', () => {
  it('is frozen and composes exactly 113 unique names in domain order', () => {
    const names = Object.keys(procedureCatalog)
    expect(Object.isFrozen(procedureCatalog)).toBe(true)
    expect(names).toHaveLength(PROCEDURE_COUNT)
    expect(new Set(names).size).toBe(PROCEDURE_COUNT)
    expect(names).toEqual(
      Object.values(domainProcedures).flatMap((procedures) => Object.keys(procedures)),
    )
  })

  it('covers the ten canonical domains and owns every name exactly once', () => {
    expect(Object.keys(domainProcedures)).toHaveLength(10)

    const owners = new Map<string, string>()
    for (const [domain, procedures] of Object.entries(domainProcedures)) {
      for (const [name, contract] of Object.entries(procedures)) {
        expect(owners.has(name), `${name} is owned by more than one domain`).toBe(false)
        owners.set(name, domain)
        expect(procedureCatalog[name as keyof typeof procedureCatalog]).toBe(contract)
      }
    }

    expect(owners.size).toBe(PROCEDURE_COUNT)
  })

  it('gives every entry an exact kind, input schema, output schema, and error list', () => {
    for (const [name, procedure] of Object.entries(procedureCatalog)) {
      expect(['query', 'mutation'], `${name} kind`).toContain(procedure.kind)
      expect(typeof procedure.input.safeParse, `${name} input`).toBe('function')
      expect(typeof procedure.output.safeParse, `${name} output`).toBe('function')
      expect(Array.isArray(procedure.errors), `${name} errors`).toBe(true)
      for (const code of procedure.errors) {
        expect(typeof code, `${name} error code`).toBe('string')
      }
    }
  })

  it('rejects a value the owning domain contract does not describe', () => {
    expect(procedureCatalog.daemonInfo.output.safeParse({ version: '1' }).success).toBe(false)
    expect(procedureCatalog.browseDirs.input.safeParse(42).success).toBe(false)
  })

  it('keeps canonical Board procedure objects out of the live catalog until BRD-002', () => {
    // Renamed procedures are not catalog members yet.
    for (const name of ['listBoardCards', 'createBoardCard', 'clearBoardColumn'] as const) {
      expect(Object.hasOwn(procedureCatalog, name)).toBe(false)
      expect(boardProcedures[name]).toBeDefined()
    }

    // Shared names still bind the live legacy schemas (void / repoPath), not canonical objects.
    for (const name of ['updateBoardCard', 'moveBoardCard', 'deleteBoardCard'] as const) {
      expect(procedureCatalog[name]).toBe(boardLiveCatalogProcedures[name])
      expect(procedureCatalog[name]).not.toBe(boardProcedures[name])
    }

    expect(Object.keys(boardLiveCatalogProcedures).sort()).toEqual(
      [
        'addBoardCard',
        'boardCards',
        'clearBoardCards',
        'deleteBoardCard',
        'moveBoardCard',
        'updateBoardCard',
      ].sort(),
    )
  })
})
