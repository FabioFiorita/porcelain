import { describe, expect, it } from 'vitest'
import { actionsProcedures } from './actions'
import { boardProcedures } from './board'
import { filesProcedures } from './files'
import { gitProcedures } from './git'
import { procedureCatalog } from './procedure-catalog'
import { initialProcedureOwnershipBaseline } from './procedure-ledger-baseline'
import { projectDataProcedures } from './project-data'
import { projectsProcedures } from './projects'
import { remoteProcedures } from './remote'
import { reviewProcedures } from './review'
import { searchProcedures } from './search'
import { terminalProcedures } from './terminal'

const domainProcedures = {
  remote: remoteProcedures,
  projects: projectsProcedures,
  files: filesProcedures,
  search: searchProcedures,
  git: gitProcedures,
  review: reviewProcedures,
  board: boardProcedures,
  actions: actionsProcedures,
  terminal: terminalProcedures,
  'project-data': projectDataProcedures,
} as const

describe('procedure catalog', () => {
  it('is frozen and composes the exact 113-name baseline in domain order', () => {
    expect(Object.isFrozen(procedureCatalog)).toBe(true)
    expect(Object.keys(procedureCatalog)).toHaveLength(113)
    expect(new Set(Object.keys(procedureCatalog)).size).toBe(113)
    expect(Object.keys(procedureCatalog)).toEqual(
      Object.values(domainProcedures).flatMap((procedures) => Object.keys(procedures)),
    )
    expect(Object.keys(procedureCatalog).sort()).toEqual(
      initialProcedureOwnershipBaseline.map(({ name }) => name).sort(),
    )
  })

  it('retains every baseline procedure record from its exact owning domain', () => {
    for (const { domain, name, kind } of initialProcedureOwnershipBaseline) {
      const domainRecord = domainProcedures[domain]
      const ownedProcedure = Object.entries(domainRecord).find(
        ([candidateName]) => candidateName === name,
      )?.[1]

      expect(ownedProcedure, `${domain}.${name} must exist`).toBeDefined()
      expect(procedureCatalog[name]).toBe(ownedProcedure)
      expect(procedureCatalog[name].kind).toBe(kind)
    }
  })

  it('keeps every record complete without locally manufactured fields', () => {
    for (const procedure of Object.values(procedureCatalog)) {
      expect(['query', 'mutation']).toContain(procedure.kind)
      expect(procedure.input).toBeDefined()
      expect(procedure.output).toBeDefined()
      expect(Array.isArray(procedure.errors)).toBe(true)
    }
  })
})
