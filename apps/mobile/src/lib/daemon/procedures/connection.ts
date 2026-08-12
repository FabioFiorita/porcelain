import { daemonInfoOutputSchema } from '@porcelain/contracts/remote'
import { z } from 'zod'

import { defineMutation, defineQuery } from '../procedure'

export type DaemonInfo = z.infer<typeof daemonInfoOutputSchema>

export const daemonInfoQuery = defineQuery<void, DaemonInfo>('daemonInfo', daemonInfoOutputSchema)

export const revokeCurrentClientMutation = defineMutation<void, void>(
  'revokeCurrentClient',
  z.void(),
)
