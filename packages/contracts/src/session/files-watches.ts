import { z } from 'zod'

/**
 * The session's declarative watch interests: the complete set of files and directories one
 * connection wants observed, replacing the imperative `watch:files` / `watch:dirs` pair in
 * the deleted horizontal session protocol.
 *
 * The frame communicates the whole desired set, not a delta, which is what makes it
 * idempotent and makes re-registering after a reconnect the same message as the first
 * registration. `projectPath` is required: watch interests are project-scoped, and a
 * registration the daemon cannot attribute to a project is one it cannot bound or clean up.
 */

/**
 * The ceiling on one session's combined interests. The value belongs to the contract so a
 * client can bound its own registration instead of discovering the limit by losing watches,
 * but it is deliberately not a schema failure: the daemon bounds by keeping the first
 * interests and dropping the extras, and rejecting the frame outright would lose the
 * registrations a client is entitled to instead of only the ones over the line. The combined
 * cap is owned solely by session-watches; the Files watcher does not re-cap.
 */
export const SESSION_WATCH_INTEREST_LIMIT = 128

export const sessionWatchesFrameSchema = z
  .object({
    t: z.literal('session:watches'),
    projectPath: z.string().min(1),
    files: z.array(z.string().min(1)),
    dirs: z.array(z.string().min(1)),
  })
  .strict()
export type SessionWatchesFrame = z.infer<typeof sessionWatchesFrameSchema>

/** Representative watch-interest values used by boundary tests and client mocks. */
export const sessionWatchesFixtures = {
  watches: {
    t: 'session:watches',
    projectPath: '/synthetic/repo',
    files: ['/synthetic/repo/src/open-document.ts'],
    dirs: ['/synthetic/repo/src'],
  },
  empty: {
    t: 'session:watches',
    projectPath: '/synthetic/repo',
    files: [],
    dirs: [],
  },
} as const
