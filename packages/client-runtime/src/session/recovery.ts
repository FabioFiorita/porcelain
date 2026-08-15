import type { SessionChange, SessionChangeFrame } from '@porcelain/contracts/session'

/**
 * The client's freshness tracker: given a connection's handshake and the sequenced change
 * frames that follow it, decide when this client can no longer prove its daemon-derived data
 * is current.
 *
 * Conservative by construction (decision 009). It never reconstructs what it missed: a change
 * notification is a signal that authoritative data moved, not the data, so the only honest
 * answer to "you missed something" is to mark the affected scope stale and let the adapter
 * refetch through ordinary queries. Nothing here replays, buffers, or guesses a mutation.
 *
 * Three things end the proof:
 *
 * 1. **Reconnect.** Delivery is best effort and non-durable; anything published while the socket
 *    was down is simply gone. Reconnect is a recovery point on its own, independent of the
 *    epoch — the daemon sequences *per subscription*
 *    (`apps/daemon/src/session/change-publisher.ts`), so a new connection to the same daemon
 *    starts a fresh counter and the epoch alone would report "nothing happened".
 * 2. **Epoch change.** A different epoch means a different daemon instance. Nothing before it is
 *    comparable, and no sequence relationship survives it.
 * 3. **Sequence gap.** Sequences are contiguous within one subscription for one epoch, so a jump
 *    proves a notification was lost. A subscription is scoped to exactly one project, so the
 *    stale scope is usually that project rather than everything this client holds — unless the
 *    frame is Project-scoped rather than checkout-scoped (Actions, ADR 0002), which names no
 *    path to narrow to and therefore widens the requirement to the whole session.
 *
 * Because a reconnect resets the counter, the first frame of a connection sets the baseline and
 * can never read as a gap. That is not a hole in the coverage: the reconnect that preceded it
 * already required a refresh, which is strictly stronger than anything the gap check would have
 * asked for.
 *
 * Pure and transport-neutral: no socket, no timers, no I/O. `client-runtime.ts` feeds it.
 */

/** Why this client can no longer prove its data is fresh. */
export type FreshnessReason = 'reconnect' | 'epoch-changed' | 'sequence-gap'

/**
 * What went stale. `session` is every daemon-derived thing this client holds; `project` narrows
 * it to the one project whose change stream lost a notification.
 */
export type FreshnessScope =
  | { readonly kind: 'session' }
  | { readonly kind: 'project'; readonly projectPath: string }

/**
 * An authoritative refresh requirement. It states what to invalidate, never what changed: the
 * adapter refetches through queries, which are the only authoritative source.
 */
export type FreshnessRequirement = {
  readonly reason: FreshnessReason
  readonly scope: FreshnessScope
}

/**
 * One observed change frame: the domain fact to apply, and the refresh requirement its arrival
 * revealed, if any. A contiguous frame on a known epoch carries no requirement — that is the
 * whole point of sequencing.
 */
export type ObservedChange = {
  readonly change: SessionChange
  readonly requirement: FreshnessRequirement | undefined
}

export type SessionFreshnessTracker = {
  /**
   * The handshake completed on the epoch the daemon reported. Returns the requirement this
   * connection created, or `undefined` for the very first connection, which has missed nothing.
   */
  readonly ready: (input: { epoch: string }) => FreshnessRequirement | undefined
  /** Account for one change frame. */
  readonly observe: (frame: SessionChangeFrame) => ObservedChange
  /** The socket dropped. The sequence expectation dies with the connection. */
  readonly disconnected: () => void
  /** The epoch currently attributed, or `undefined` before the first ready. */
  readonly epoch: () => string | undefined
  /** The last sequence accepted on this connection, or `undefined` before the first frame. */
  readonly sequence: () => number | undefined
}

const SESSION_SCOPE: FreshnessScope = { kind: 'session' }

export function createSessionFreshnessTracker(): SessionFreshnessTracker {
  let epoch: string | undefined
  let lastSequence: number | undefined
  let everConnected = false

  return {
    ready({ epoch: readyEpoch }) {
      // A new connection's sequence starts over regardless of epoch, so the expectation is
      // dropped before anything else is decided.
      lastSequence = undefined
      const previousEpoch = epoch
      epoch = readyEpoch

      if (!everConnected) {
        everConnected = true
        return undefined
      }
      return {
        reason: previousEpoch === readyEpoch ? 'reconnect' : 'epoch-changed',
        scope: SESSION_SCOPE,
      }
    },

    observe(frame) {
      if (frame.epoch !== epoch) {
        // The daemon behind this socket is not the one that said ready. Adopt it and treat
        // everything held as unproven; the change itself is still a real fact worth applying.
        epoch = frame.epoch
        lastSequence = frame.sequence
        return {
          change: frame.change,
          requirement: { reason: 'epoch-changed', scope: SESSION_SCOPE },
        }
      }

      const expected = lastSequence === undefined ? frame.sequence : lastSequence + 1
      if (frame.sequence > expected) {
        lastSequence = frame.sequence
        return {
          change: frame.change,
          requirement: {
            reason: 'sequence-gap',
            // A Project-scoped change (Actions) names no checkout, so a gap around it
            // cannot be narrowed to one Project path — recover the whole session.
            scope:
              'projectPath' in frame.change
                ? { kind: 'project', projectPath: frame.change.projectPath }
                : SESSION_SCOPE,
          },
        }
      }

      // A repeat or out-of-order sequence is not proof of loss: notifications are idempotent
      // and safe to process twice, and moving the expectation backwards would manufacture a
      // gap out of the next perfectly ordinary frame.
      if (frame.sequence === expected) lastSequence = frame.sequence
      return { change: frame.change, requirement: undefined }
    },

    disconnected() {
      lastSequence = undefined
    },

    epoch() {
      return epoch
    },

    sequence() {
      return lastSequence
    },
  }
}
