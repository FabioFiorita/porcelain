import { z } from 'zod'

/**
 * Typed Terminal roster identity.
 *
 * Daemon-global: the wire list is void and clients filter by project path after
 * the response. No project-path dimension on this identity.
 */

export const terminalSessionsQuerySchema = z
  .object({
    domain: z.literal('terminal'),
    name: z.literal('sessions'),
  })
  .strict()

/** Alias of the sessions schema until a second Terminal identity exists. */
export const terminalIdentitySchema = terminalSessionsQuerySchema

export type TerminalSessionsQuery = Readonly<z.infer<typeof terminalSessionsQuerySchema>>
export type TerminalIdentity = TerminalSessionsQuery

/** Build the daemon-global Terminal sessions identity. */
export function terminalSessionsQuery(): TerminalSessionsQuery {
  return { domain: 'terminal', name: 'sessions' }
}
