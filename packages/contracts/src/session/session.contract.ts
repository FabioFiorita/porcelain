import { z } from 'zod'
import { actionsChangeSchema } from '../actions'
import {
  protocolUpdateRequiredErrorDetailsSchema,
  protocolUpdateRequiredErrorSchema,
} from '../errors'
import { filesChangeSchema } from '../files'
import { gitChangeSchema } from '../git'
import { projectsChangeSchema } from '../projects'
import { PROTOCOL_VERSION, protocolVersionSchema } from '../protocol'
import { reviewChangeSchema } from '../review'
import { terminalChangeSchema } from '../terminal'

/**
 * The session channel's cross-domain envelope: the handshake that opens it and the frame
 * that carries one domain change notification. The domains own their own vocabulary
 * (`<domain>/<domain>.notifications.ts`); this module only composes them, so a new category
 * cannot reach the wire without a domain declaring it.
 */

/**
 * Every domain change fact the session can push, discriminated by `kind`. Composed from the
 * domain unions rather than relisted, so this union and the domain modules cannot disagree.
 */
export const sessionChangeSchema = z.discriminatedUnion('kind', [
  ...filesChangeSchema.options,
  ...gitChangeSchema.options,
  ...reviewChangeSchema.options,
  ...projectsChangeSchema.options,
  ...actionsChangeSchema.options,
  ...terminalChangeSchema.options,
])
export type SessionChange = z.infer<typeof sessionChangeSchema>

/**
 * One change notification with the freshness metadata a client needs to know whether it can
 * trust the sequence at all. `epoch` identifies this daemon instance: a new epoch means the
 * daemon was replaced and nothing before it is comparable. `sequence` is monotonic within an
 * epoch, so a gap is a client's proof it missed a notification and must recover through
 * queries. Neither promises replay — delivery stays best effort and non-durable.
 */
export const sessionChangeFrameSchema = z
  .object({
    t: z.literal('session:change'),
    epoch: z.string().min(1),
    sequence: z.number().int().nonnegative(),
    change: sessionChangeSchema,
  })
  .strict()
export type SessionChangeFrame = z.infer<typeof sessionChangeFrameSchema>

/**
 * The client's opening frame. It announces the protocol it speaks and nothing else: identity
 * is the credential the upgrade already authenticated, never anything the client says.
 *
 * `protocolVersion` is the literal this build speaks, so a frame from a client on another
 * protocol fails this schema. The daemon boundary implementing the handshake must therefore
 * read the raw version off the parsed JSON before validating, or it cannot fill `received`
 * on the mismatch reply it owes that client.
 */
export const sessionHelloFrameSchema = z
  .object({
    t: z.literal('session:hello'),
    protocolVersion: protocolVersionSchema,
  })
  .strict()
export type SessionHelloFrame = z.infer<typeof sessionHelloFrameSchema>

/**
 * The daemon's accepting reply. It repeats its own protocol version and states the epoch the
 * client should attribute every following `sequence` to.
 */
export const sessionReadyFrameSchema = z
  .object({
    t: z.literal('session:ready'),
    protocolVersion: protocolVersionSchema,
    epoch: z.string().min(1),
  })
  .strict()
export type SessionReadyFrame = z.infer<typeof sessionReadyFrameSchema>

/**
 * The daemon's refusing reply. `code` and the version pair are taken from the landed public
 * error so the socket and the HTTP boundary report one update-required outcome; `received` is
 * null when the client announced no version at all.
 */
export const sessionMismatchFrameSchema = z
  .object({
    t: z.literal('session:mismatch'),
    code: protocolUpdateRequiredErrorSchema.shape.code,
    expected: protocolUpdateRequiredErrorDetailsSchema.shape.expected,
    received: protocolUpdateRequiredErrorDetailsSchema.shape.received,
  })
  .strict()
export type SessionMismatchFrame = z.infer<typeof sessionMismatchFrameSchema>

/** Representative session wire values used by boundary tests and client mocks. */
export const sessionContractFixtures = {
  hello: { t: 'session:hello', protocolVersion: PROTOCOL_VERSION },
  ready: {
    t: 'session:ready',
    protocolVersion: PROTOCOL_VERSION,
    epoch: 'synthetic-epoch',
  },
  mismatch: {
    t: 'session:mismatch',
    code: 'protocol.update-required',
    expected: PROTOCOL_VERSION,
    received: null,
  },
  change: {
    t: 'session:change',
    epoch: 'synthetic-epoch',
    sequence: 0,
    change: { kind: 'files.scope-changed', projectPath: '/synthetic/repo' },
  },
} as const
