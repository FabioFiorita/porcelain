import type { DevServerTarget } from '@porcelain/contracts/terminal'
import { z } from 'zod'

/**
 * Typed development-server roster identity.
 *
 * Unlike the Terminal session roster (daemon-global, filtered client-side by path), a server
 * record already knows which Project and Worktree it belongs to — so the identity carries that
 * target and the wire filters. Two Worktrees of the same Project are separate cache rows, which
 * is what keeps a tab bound to one Worktree from ever showing another's processes.
 */

export const devServersQuerySchema = z
  .object({
    domain: z.literal('terminal'),
    name: z.literal('dev-servers'),
    projectId: z.string().min(1),
    worktreeId: z.string().min(1),
  })
  .strict()

export type DevServersQuery = Readonly<z.infer<typeof devServersQuerySchema>>

export function devServersQuery(
  target: Pick<DevServerTarget, 'projectId' | 'worktreeId'>,
): DevServersQuery {
  return {
    domain: 'terminal',
    name: 'dev-servers',
    projectId: target.projectId,
    worktreeId: target.worktreeId,
  }
}
