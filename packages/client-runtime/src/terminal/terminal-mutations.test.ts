import { terminalContractFixtures, terminalProcedures } from '@porcelain/contracts/terminal'
import { describe, expect, it } from 'vitest'
import { terminalMutations } from './terminal-mutations'
import { terminalSessionsQuery } from './terminal-queries'

describe('terminalMutations', () => {
  it('binds rename to the canonical renameTerminal procedure', () => {
    expect(terminalMutations.rename.procedure).toBe(terminalProcedures.renameTerminal)
    expect(terminalMutations.rename.procedureName).toBe('renameTerminal')
  })

  it('affects exactly the daemon-global sessions identity', () => {
    const affected = terminalMutations.rename.affectedQueries(
      terminalContractFixtures.renameTerminal.input,
    )
    expect(affected).toEqual([terminalSessionsQuery()])
    expect(affected).toHaveLength(1)
    expect(terminalMutations.rename.requiresAuthoritativeRefetch).toBe(true)
    expect(Object.hasOwn(terminalMutations.rename, 'optimistic')).toBe(false)
    expect(Object.hasOwn(terminalMutations.rename, 'optimisticTransition')).toBe(false)
  })
})
