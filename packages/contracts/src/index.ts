// Wire protocol + leaf types + the composed procedure catalog (zod only).
// Domain schemas are imported from their own subpath (`@porcelain/contracts/<domain>`).
// AppRouter type lives on the daemon (`@backend/api` / apps/daemon) — contracts
// must never import apps/* (architecture charter).

export {
  COMMIT_MODEL_IDS,
  COMMIT_MODEL_OPTIONS,
  type CommitGroupGenerationGroup,
  type CommitModel,
  type CommitModelOption,
  commitGroupGenerationGroupSchema,
  commitGroupGenerationOutputSchema,
  commitMessageGenerationInputSchema,
  commitMessageGenerationOutputSchema,
  commitModelOptionSchema,
  commitModelOptionsSchema,
  commitModelProviderSchema,
  commitModelSchema,
} from './commit-model'

export {
  type EndpointKind,
  endpointKind,
  endpointKindSchema,
  orderedEndpointUrls,
} from './environment'
export {
  actionsNotFoundErrorDetailsSchema,
  actionsNotFoundErrorSchema,
  actionsTargetInvalidErrorDetailsSchema,
  actionsTargetInvalidErrorSchema,
  actionsUnavailableErrorSchema,
  actionsUntrustedErrorDetailsSchema,
  actionsUntrustedErrorSchema,
  authForbiddenErrorSchema,
  authUnauthenticatedErrorSchema,
  boardCardNotFoundErrorDetailsSchema,
  boardCardNotFoundErrorSchema,
  boardInvalidTitleErrorDetailsSchema,
  boardInvalidTitleErrorSchema,
  boardUnavailableErrorSchema,
  gitBranchAlreadyExistsErrorSchema,
  gitBranchNotFoundErrorSchema,
  gitNotARepositoryErrorSchema,
  gitWorkingTreeConflictErrorSchema,
  gitWorktreeConflictErrorSchema,
  internalUnexpectedErrorSchema,
  type PorcelainError,
  PUBLIC_ERROR_CATEGORY_VALUES,
  type PublicErrorCategory,
  type PublicErrorCode,
  protocolUpdateRequiredErrorDetailsSchema,
  protocolUpdateRequiredErrorSchema,
  publicErrorCategorySchema,
  publicErrorFixtures,
  publicErrorSchema,
  requestInvalidErrorSchema,
  resourceNotFoundErrorSchema,
  resourceUnavailableErrorSchema,
  stateConflictErrorSchema,
  type TerminalPublicError,
  terminalCapacityErrorSchema,
  terminalExitedErrorSchema,
  terminalInvalidSizeErrorSchema,
  terminalNotFoundErrorSchema,
  terminalPasteUnavailableErrorSchema,
  terminalPublicErrorSchema,
} from './errors'
export { type HeadRef, headLabel } from './head'
export { type ProcedureName, procedureCatalog } from './procedure-catalog'
export {
  PROTOCOL_VERSION,
  PROTOCOL_VERSION_HEADER,
  type ProtocolVersion,
  protocolVersionSchema,
} from './protocol'
// Session wire caps and paste prompt helpers live on the terminal stream contract
// (`@porcelain/contracts/terminal`). The legacy horizontal `session contracts` surface is gone.
