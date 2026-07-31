// The default entry is the runtime wire protocol and nothing else: zod-only, so
// it typechecks and bundles under every client's toolchain (Vite, Metro). The
// router type lives behind `@porcelain/contracts/router` on purpose — see there.
export {
  type AppEvent,
  appEventSchema,
  type ClientMessage,
  clientMessageSchema,
  type ServerMessage,
  serverMessageSchema,
} from './ws-protocol'
