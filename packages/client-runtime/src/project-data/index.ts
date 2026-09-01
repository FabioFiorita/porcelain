/**
 * Shared Project Data client semantics.
 *
 * Framework-neutral disposition/visibility identities, two
 * refetch-only mutation consequence definitions, and `describeDisposition`.
 * Web and mobile adapters bind these definitions. No notifications module —
 * mutations refetch through the owning query identities.
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
  projectDataProjectKey,
  projectDataQuerySchema,
  projectDataVisibilityQuery,
} from './project-data-queries'
