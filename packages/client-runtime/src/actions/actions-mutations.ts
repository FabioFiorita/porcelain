import {
  type AddActionInput,
  actionsProcedures,
  type DeleteActionInput,
  type MoveActionInput,
  type TrustActionsInput,
  type UpdateActionInput,
} from '@porcelain/contracts/actions'
import {
  type ActionsQuery,
  type ActionTrustQuery,
  actionsProjectKey,
  actionsQuery,
  actionTrustQuery,
} from './actions-queries'

/**
 * Actions mutation consequence definitions (ACT-002).
 *
 * Each entry binds exactly one ACT-001 mutation procedure and the dual list+trust identities
 * it affects. No create-from-list optimism, no reconciliation module, no decorative
 * `optimistic` field. Transport and React stay in adapters (ACT-003).
 */

export type ActionsMutationProcedureName =
  | 'trustActions'
  | 'addAction'
  | 'updateAction'
  | 'moveAction'
  | 'deleteAction'

export type ActionsMutationDefinition<TName extends ActionsMutationProcedureName, TInput> = {
  /** Canonical ACT-001 procedure contract object (not a free-form invalidation string). */
  readonly procedure: (typeof actionsProcedures)[TName]
  /** Catalog key of the bound ACT-001 procedure. */
  readonly procedureName: TName
  readonly affectedQueries: (input: TInput) => readonly [ActionsQuery, ActionTrustQuery]
  readonly requiresAuthoritativeRefetch: true
}

function dualIdentities(repoPath: string): readonly [ActionsQuery, ActionTrustQuery] {
  const key = actionsProjectKey(repoPath)
  return [actionsQuery(key), actionTrustQuery(key)]
}

export const actionsMutations = {
  trust: {
    procedure: actionsProcedures.trustActions,
    procedureName: 'trustActions',
    affectedQueries: (input: TrustActionsInput): readonly [ActionsQuery, ActionTrustQuery] =>
      dualIdentities(input.repoPath),
    requiresAuthoritativeRefetch: true,
  },
  add: {
    procedure: actionsProcedures.addAction,
    procedureName: 'addAction',
    affectedQueries: (input: AddActionInput): readonly [ActionsQuery, ActionTrustQuery] =>
      dualIdentities(input.repoPath),
    requiresAuthoritativeRefetch: true,
  },
  update: {
    procedure: actionsProcedures.updateAction,
    procedureName: 'updateAction',
    affectedQueries: (input: UpdateActionInput): readonly [ActionsQuery, ActionTrustQuery] =>
      dualIdentities(input.repoPath),
    requiresAuthoritativeRefetch: true,
  },
  move: {
    procedure: actionsProcedures.moveAction,
    procedureName: 'moveAction',
    affectedQueries: (input: MoveActionInput): readonly [ActionsQuery, ActionTrustQuery] =>
      dualIdentities(input.repoPath),
    requiresAuthoritativeRefetch: true,
  },
  delete: {
    procedure: actionsProcedures.deleteAction,
    procedureName: 'deleteAction',
    affectedQueries: (input: DeleteActionInput): readonly [ActionsQuery, ActionTrustQuery] =>
      dualIdentities(input.repoPath),
    requiresAuthoritativeRefetch: true,
  },
} as const satisfies {
  readonly trust: ActionsMutationDefinition<'trustActions', TrustActionsInput>
  readonly add: ActionsMutationDefinition<'addAction', AddActionInput>
  readonly update: ActionsMutationDefinition<'updateAction', UpdateActionInput>
  readonly move: ActionsMutationDefinition<'moveAction', MoveActionInput>
  readonly delete: ActionsMutationDefinition<'deleteAction', DeleteActionInput>
}

export type ActionsMutation = (typeof actionsMutations)[keyof typeof actionsMutations]
