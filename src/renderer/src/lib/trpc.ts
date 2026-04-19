import { createTRPCProxyClient } from '@trpc/client'
import { ipcLink } from 'electron-trpc/renderer'
import type { AppRouter } from '../../../main/api'

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [ipcLink()],
})
