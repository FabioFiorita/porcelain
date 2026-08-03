// Wire protocol + leaf types + full procedure I/O catalog (zod only).
// AppRouter type lives on the daemon (`@backend/api` / apps/daemon) — contracts
// must never import apps/* (architecture charter).

export {
  type EndpointKind,
  endpointKind,
  endpointKindSchema,
  orderedEndpointUrls,
} from './environment'
export { type HeadRef, headLabel } from './head'
export {
  actionSchema,
  boardCardSchema,
  browseDirsOutputSchema,
  daemonInfoOutputSchema,
  dirEntrySchema,
  fileViewSchema,
  flowGroupSchema,
  headRefSchema,
  PROCEDURE_NAMES,
  type ProcedureIo,
  type ProcedureName,
  procedureIo,
  procedureNames,
  refinedProcedureIo,
  repoInfoSchema,
  reviewCommentSchema,
  terminalInfoSchema,
} from './procedures'
export {
  type AppEvent,
  appEventSchema,
  type ClientMessage,
  clientMessageSchema,
  type ServerMessage,
  serverMessageSchema,
} from './ws-protocol'
