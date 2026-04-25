import { createTRPCProxyClient } from '@trpc/client'
import { createTRPCReact } from '@trpc/react-query'
import { ipcLink } from 'electron-trpc/renderer'
import type { AppRouter } from '../../../main/api'

/** React hooks — use in components. */
export const trpc = createTRPCReact<AppRouter>()

/** Vanilla client — use in zustand stores and non-React code. */
export const trpcClient = createTRPCProxyClient<AppRouter>({
  links: [ipcLink()],
})
