import type { AppRouter } from '@main/api'
import { createTRPCClientProxy } from '@trpc/client'
import { createTRPCReact } from '@trpc/react-query'
import { ipcLink } from 'electron-trpc/renderer'

/** React hooks — use in components. */
export const trpc = createTRPCReact<AppRouter>()

/**
 * ONE underlying client for the whole renderer. Two clients (hooks + vanilla)
 * each had their own ipcLink over the same IPC channel; their per-client
 * request-id counters collide, so one procedure's response could resolve a
 * different procedure's call — random "x.map is not a function" crashes.
 */
export const client = trpc.createClient({ links: [ipcLink()] })

/** Vanilla proxy over the SAME client — zustand stores and non-React code. */
export const trpcClient = createTRPCClientProxy<AppRouter>(client)
