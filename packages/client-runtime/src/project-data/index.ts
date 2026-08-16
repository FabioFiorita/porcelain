/**
 * Shared Project Data client semantics (PDT-003).
 *
 * Framework-neutral layers/disposition/visibility identities, three
 * refetch-only mutation consequence definitions, and `describeDisposition`.
 * Web and mobile adapters bind these definitions. No notifications module —
 * mutations refetch; `review.changed` still refreshes layers from the adapters.
 */

export { type Disposition, describeDisposition } from './describe-disposition'
export {
  type ProjectDataMutation,
  type ProjectDataMutationDefinition,
  projectDataMutations,
} from './project-data-mutations'
export {
  ProjectDataIdentityError,
  type ProjectDataQuery,
  projectDataDispositionsQuery,
  projectDataLayersQuery,
  projectDataProjectKey,
  projectDataQuerySchema,
  projectDataVisibilityQuery,
} from './project-data-queries'
