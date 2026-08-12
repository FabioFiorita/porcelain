import { createValidatingDaemonMock } from '@porcelain/client-runtime/testing/daemon-mock'
import { publicErrorFixtures, publicErrorSchema } from '@porcelain/contracts'
import {
  actionsChangeSchema,
  actionsContractFixtures,
  actionsProcedures,
} from '@porcelain/contracts/actions'
import { describe, expect, it } from 'vitest'
import { actionsMutations } from './actions-mutations'
import { actionsQuery, actionTrustQuery } from './actions-queries'

const fixtures = actionsContractFixtures
const OTHER_PATH = '/synthetic/other-repo'

const actionsCatalog = {
  procedures: actionsProcedures,
  notification: actionsChangeSchema,
  publicError: publicErrorSchema,
}

describe('actionsMutations', () => {
  it('binds each definition to exactly one canonical ACT-001 procedure', () => {
    expect(actionsMutations.trust.procedure).toBe(actionsProcedures.trustActions)
    expect(actionsMutations.trust.procedureName).toBe('trustActions')

    expect(actionsMutations.add.procedure).toBe(actionsProcedures.addAction)
    expect(actionsMutations.add.procedureName).toBe('addAction')

    expect(actionsMutations.update.procedure).toBe(actionsProcedures.updateAction)
    expect(actionsMutations.update.procedureName).toBe('updateAction')

    expect(actionsMutations.move.procedure).toBe(actionsProcedures.moveAction)
    expect(actionsMutations.move.procedureName).toBe('moveAction')

    expect(actionsMutations.delete.procedure).toBe(actionsProcedures.deleteAction)
    expect(actionsMutations.delete.procedureName).toBe('deleteAction')
  })

  it('affects list then trust for the input repoPath only', () => {
    const cases = [
      { definition: actionsMutations.trust, input: fixtures.trustActions.input },
      { definition: actionsMutations.add, input: fixtures.addAction.input },
      { definition: actionsMutations.update, input: fixtures.updateAction.input },
      { definition: actionsMutations.move, input: fixtures.moveAction.input },
      { definition: actionsMutations.delete, input: fixtures.deleteAction.input },
    ] as const

    for (const { definition, input } of cases) {
      const affected = definition.affectedQueries(input)
      const key = input.repoPath
      expect(affected).toEqual([actionsQuery(key), actionTrustQuery(key)])
      expect(affected).toHaveLength(2)
      expect(affected[0].name).toBe('list')
      expect(affected[1].name).toBe('trust')
      expect(affected).not.toEqual([actionsQuery(OTHER_PATH), actionTrustQuery(OTHER_PATH)])
      expect(definition.requiresAuthoritativeRefetch).toBe(true)
      expect(Object.hasOwn(definition, 'optimistic')).toBe(false)
      expect(Object.hasOwn(definition, 'optimisticTransition')).toBe(false)
    }
  })

  it('dispatches all five bound procedures through the validating daemon mock', async () => {
    const daemon = createValidatingDaemonMock(actionsCatalog, {
      trustActions: () => ({ ok: true, value: fixtures.trustActions.output }),
      addAction: () => ({ ok: true, value: fixtures.addAction.output }),
      updateAction: () => ({ ok: true, value: fixtures.updateAction.output }),
      moveAction: () => ({ ok: true, value: fixtures.moveAction.output }),
      deleteAction: () => ({ ok: true, value: fixtures.deleteAction.output }),
    })

    const outcomes = await Promise.all([
      daemon.dispatch({
        procedure: actionsMutations.trust.procedureName,
        kind: actionsMutations.trust.procedure.kind,
        input: fixtures.trustActions.input,
      }),
      daemon.dispatch({
        procedure: actionsMutations.add.procedureName,
        kind: actionsMutations.add.procedure.kind,
        input: fixtures.addAction.input,
      }),
      daemon.dispatch({
        procedure: actionsMutations.update.procedureName,
        kind: actionsMutations.update.procedure.kind,
        input: fixtures.updateAction.input,
      }),
      daemon.dispatch({
        procedure: actionsMutations.move.procedureName,
        kind: actionsMutations.move.procedure.kind,
        input: fixtures.moveAction.input,
      }),
      daemon.dispatch({
        procedure: actionsMutations.delete.procedureName,
        kind: actionsMutations.delete.procedure.kind,
        input: fixtures.deleteAction.input,
      }),
    ])

    expect(outcomes.map((outcome) => outcome.ok)).toEqual([true, true, true, true, true])
    expect(daemon.requests().map((request) => request.procedure)).toEqual([
      'trustActions',
      'addAction',
      'updateAction',
      'moveAction',
      'deleteAction',
    ])
  })

  it('preserves a typed public-error refusal without a local cache transition', async () => {
    const refusal = publicErrorFixtures['actions.not-found']
    const daemon = createValidatingDaemonMock(actionsCatalog, {
      updateAction: () => ({ ok: false, error: refusal }),
    })

    await expect(
      daemon.dispatch({
        procedure: actionsMutations.update.procedureName,
        kind: actionsMutations.update.procedure.kind,
        input: fixtures.updateAction.input,
      }),
    ).resolves.toEqual({ ok: false, error: refusal })

    // Definitions declare authoritative refetch only — no optimistic patch path.
    expect(actionsMutations.update.requiresAuthoritativeRefetch).toBe(true)
    expect(Object.hasOwn(actionsMutations.update, 'optimisticTransition')).toBe(false)
    expect(Object.hasOwn(actionsMutations.update, 'optimistic')).toBe(false)
  })
})
