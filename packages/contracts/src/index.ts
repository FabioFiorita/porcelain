// The default entry carries the wire protocol and the leaf types both clients
// render: dependency-light (zod only), so it typechecks and bundles under every
// client's toolchain (Vite, Metro). The router type lives behind
// `@porcelain/contracts/router` on purpose — see there.

export {
  type EndpointKind,
  endpointKind,
  endpointKindSchema,
  orderedEndpointUrls,
} from './environment'
export { type HeadRef, headLabel } from './head'
export {
  type AppEvent,
  appEventSchema,
  type ClientMessage,
  clientMessageSchema,
  type ServerMessage,
  serverMessageSchema,
} from './ws-protocol'
