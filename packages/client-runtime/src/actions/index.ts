/**
 * Shared Actions client semantics (ACT-002).
 *
 * Framework-neutral list/trust query identities, five non-optimistic mutation consequence
 * definitions, exhaustive `actions.changed` → identity mapping, and pure `prepareActionRun`.
 * Web and mobile adapters bind these definitions (ACT-003).
 */

export {
  type ActionsMutation,
  type ActionsMutationDefinition,
  actionsMutations,
} from './actions-mutations'
export { actionsNotificationEffects } from './actions-notifications'
export {
  type ActionsIdentity,
  ActionsIdentityError,
  type ActionsQuery,
  type ActionTrustQuery,
  actionsIdentitySchema,
  actionsProjectKey,
  actionsQuery,
  actionsQuerySchema,
  actionTrustQuery,
  actionTrustQuerySchema,
} from './actions-queries'
export {
  type PrepareActionRunContext,
  type PrepareActionRunRefusal,
  type PrepareActionRunResult,
  type PreparedActionRun,
  prepareActionRun,
} from './prepare-action-run'
