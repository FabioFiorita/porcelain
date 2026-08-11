import { z } from 'zod'

/**
 * The daemon a Web cache entry belongs to.
 *
 * Every Web server-state key is `[identity, scope]`, so one window pointed at two daemons
 * (or one daemon across an upgrade) never reads another's cached rows. Files, Board, and
 * Review each carried an identical handwritten copy of this shape; they now share one
 * strict schema, and the key predicates parse against it instead of probing for `host` and
 * `version` by hand.
 *
 * Both fields are nullable because daemon identity is unknown until `daemonInfo` lands —
 * a pre-identity key is a real scope, not a malformed one.
 */
export const daemonScopeSchema = z
  .object({
    host: z.string().nullable(),
    version: z.string().nullable(),
  })
  .strict()

export type DaemonScope = Readonly<z.infer<typeof daemonScopeSchema>>
