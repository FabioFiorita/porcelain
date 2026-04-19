import { createTRPCClient } from '@trpc/client'
import { ipcLink } from 'electron-trpc/renderer'
import type { AppRouter } from '../../../main/api'

export const trpc = createTRPCClient<AppRouter>({
  links: [ipcLink()],
})
