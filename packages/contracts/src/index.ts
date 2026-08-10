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
  authForbiddenErrorSchema,
  authUnauthenticatedErrorSchema,
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
} from './errors'
export { type HeadRef, headLabel } from './head'
export { type ProcedureName, procedureCatalog } from './procedure-catalog'
export { PROTOCOL_VERSION, type ProtocolVersion, protocolVersionSchema } from './protocol'
export {
  type AppEvent,
  appEventSchema,
  type ClientMessage,
  clientMessageSchema,
  MAX_PASTE_FILE_BYTES,
  MAX_PASTE_IMAGE_BYTES,
  MAX_SESSION_MESSAGE_BYTES,
  MAX_TERMINAL_WRITE_CODE_UNITS,
  type ServerMessage,
  serverMessageSchema,
  terminalFilePromptReference,
  terminalImagePromptReference,
} from './ws-protocol'
