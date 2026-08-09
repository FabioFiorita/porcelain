import { describe, expect, it } from 'vitest'
import { unmigratedProcedureLedger, unmigratedProcedureNames } from './procedure-ledger'
import { initialProcedureOwnershipBaseline } from './procedure-ledger-baseline'
import { PROCEDURE_NAMES } from './procedures/names'

describe('unmigrated procedure ledger', () => {
  it('contains each current procedure exactly once', () => {
    expect(unmigratedProcedureNames).toHaveLength(113)
    expect(new Set(unmigratedProcedureNames).size).toBe(113)
    expect([...unmigratedProcedureNames].sort()).toEqual([...PROCEDURE_NAMES].sort())
  })

  it('keeps the exact temporary initial ownership baseline', () => {
    expect(initialProcedureOwnershipBaseline).toHaveLength(113)
    expect(new Set(initialProcedureOwnershipBaseline.map(({ name }) => name)).size).toBe(113)
    expect(initialProcedureOwnershipBaseline.map(({ name }) => name).sort()).toEqual(
      [...PROCEDURE_NAMES].sort(),
    )

    const baselineByName = new Map(
      initialProcedureOwnershipBaseline.map((entry) => [entry.name, entry]),
    )
    for (const [domain, entries] of Object.entries(unmigratedProcedureLedger)) {
      for (const entry of entries) {
        expect(baselineByName.get(entry.name)).toEqual({ ...entry, domain })
      }
    }
  })

  it('contains exactly the ten canonical domains', () => {
    expect(Object.keys(unmigratedProcedureLedger).sort()).toEqual([
      'actions',
      'board',
      'files',
      'git',
      'project-data',
      'projects',
      'remote',
      'review',
      'search',
      'terminal',
    ])
  })

  it('declares only query and mutation kinds with the expected current balance', () => {
    const entries = Object.values(unmigratedProcedureLedger).flat()
    expect(entries.every(({ kind }) => kind === 'query' || kind === 'mutation')).toBe(true)
    expect(entries.filter(({ kind }) => kind === 'query')).toHaveLength(53)
    expect(entries.filter(({ kind }) => kind === 'mutation')).toHaveLength(60)
  })
})
