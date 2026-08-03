// REMOVED — contracts must not import apps/* (architecture charter).
// Web/desktop typed clients: `import type { AppRouter } from '@backend/api'`.
// Mobile uses zod procedure descriptors + packages/contracts procedureIo.
// This file remains only so stale import paths fail with a clear message.
export type AppRouter = never
