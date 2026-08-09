import { describe, expect, it } from 'vitest'
import { unmigratedProcedureLedger, unmigratedProcedureNames } from './procedure-ledger'
import { PROCEDURE_NAMES } from './procedures/names'

describe('unmigrated procedure ledger', () => {
  it('contains each current procedure exactly once', () => {
    expect(unmigratedProcedureNames).toHaveLength(113)
    expect(new Set(unmigratedProcedureNames).size).toBe(113)
    expect([...unmigratedProcedureNames].sort()).toEqual([...PROCEDURE_NAMES].sort())
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
