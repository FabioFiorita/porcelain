import { createValidatingDaemonMock } from '@porcelain/client-runtime/testing/daemon-mock'
import { publicErrorFixtures, publicErrorSchema } from '@porcelain/contracts'
import {
  actionsChangeSchema,
  actionsContractFixtures,
  actionsProcedures,
} from '@porcelain/contracts/actions'
import { mutableFixture } from '@porcelain/contracts/testing'
import { describe, expect, it } from 'vitest'
import {
  type ActionsMutationDefinition,
  type ActionsMutationProcedureName,
  actionsMutations,
} from './actions-mutations'
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
    // Resolved where the pairing still holds. Carrying `{ definition, input }` through an array
    // loses it: TypeScript unions the two fields independently, so `definition.affectedQueries`
    // ends up demanding the intersection of every input shape and no fixture satisfies it.
    const bind = <Name extends ActionsMutationProcedureName, Input extends { repoPath: string }>(
      definition: ActionsMutationDefinition<Name, Input>,
      input: Input,
    ) => ({
      affected: definition.affectedQueries(input),
      repoPath: input.repoPath,
      requiresAuthoritativeRefetch: definition.requiresAuthoritativeRefetch,
      declaresOptimistic: Object.hasOwn(definition, 'optimistic'),
      declaresOptimisticTransition: Object.hasOwn(definition, 'optimisticTransition'),
    })

    const cases = [
      bind(actionsMutations.trust, mutableFixture(fixtures.trustActions.input)),
      bind(actionsMutations.add, mutableFixture(fixtures.addAction.input)),
      bind(actionsMutations.update, mutableFixture(fixtures.updateAction.input)),
      bind(actionsMutations.move, mutableFixture(fixtures.moveAction.input)),
      bind(actionsMutations.delete, mutableFixture(fixtures.deleteAction.input)),
    ]

    for (const bound of cases) {
      const key = bound.repoPath
      expect(bound.affected).toEqual([actionsQuery(key), actionTrustQuery(key)])
      expect(bound.affected).toHaveLength(2)
      expect(bound.affected[0].name).toBe('list')
      expect(bound.affected[1].name).toBe('trust')
      expect(bound.affected).not.toEqual([actionsQuery(OTHER_PATH), actionTrustQuery(OTHER_PATH)])
      expect(bound.requiresAuthoritativeRefetch).toBe(true)
      expect(bound.declaresOptimistic).toBe(false)
      expect(bound.declaresOptimisticTransition).toBe(false)
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
