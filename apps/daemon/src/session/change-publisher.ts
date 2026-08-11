import {
  type SessionChange,
  type SessionChangeFrame,
  sessionChangeFrameSchema,
  sessionChangeSchema,
} from '@porcelain/contracts/session'

/**
 * The daemon's session change publisher: the one place a domain change fact becomes a
 * sequenced `session:change` frame, and the one place that decides which sessions are
 * allowed to see it.
 *
 * Activated with the session gateway in `session/live-session.ts`. Domain sources publish
 * through `publishSessionChange` / `connectSource`; there is one process-wide publisher.
 *
 * Three rules make it different from the bus it replaces:
 *
 * 1. **Parsed at the boundary.** A change is untrusted until `sessionChangeSchema` accepts it,
 *    and the assembled frame is parsed again before it leaves — the daemon proves it still
 *    honors its own wire contract instead of trusting a TypeScript type (decision 010).
 * 2. **Scoped, never broadcast.** A subscription delivers only changes for the project it is
 *    scoped to, and an unscoped subscription receives nothing. Fail closed: a session that has
 *    not declared a project has not earned another project's change stream.
 * 3. **Sequenced per subscription.** `epoch` identifies this daemon instance; `sequence` is
 *    monotonic and gapless *within one subscription* for that epoch. A single daemon-wide
 *    counter would look like a permanent gap to every client (decision 009 reads a gap as
 *    "you missed something, recover through queries"), so a busy neighbouring project would
 *    make every session refetch forever. The client-visible promise — contiguous sequences
 *    within an epoch on my connection — is exactly what per-subscription counting provides.
 *
 * Delivery stays best effort and non-durable: there is no buffer, no replay, and no retry for
 * a subscriber that is gone. That is the guarantee decision 009 accepted, and clients recover
 * through queries rather than through this module growing an event log.
 */

/**
 * The change categories a source is allowed to produce, keyed by the domain prefix the
 * contract union already discriminates on.
 */
export const SESSION_CHANGE_CATEGORIES = ['files', 'git', 'review', 'board', 'actions'] as const
export type SessionChangeCategory = (typeof SESSION_CHANGE_CATEGORIES)[number]

/**
 * Every change kind's owning category. Written out rather than parsed off the `kind` prefix so
 * the compiler owns exhaustiveness: `satisfies Record<SessionChange['kind'], …>` fails the
 * build the moment a domain adds a category to the union, which is cheaper than discovering it
 * as a runtime cast that quietly produced a category nobody serves.
 */
const CATEGORY_BY_CHANGE_KIND = {
  'files.scope-changed': 'files',
  'files.tree-changed': 'files',
  'files.content-changed': 'files',
  'git.working-tree-changed': 'git',
  'review.changed': 'review',
  'board.changed': 'board',
  'actions.changed': 'actions',
} satisfies Record<SessionChange['kind'], SessionChangeCategory>

/** Which source category a change belongs to. Total over the contract union. */
export function sessionChangeCategory(change: SessionChange): SessionChangeCategory {
  return CATEGORY_BY_CHANGE_KIND[change.kind]
}

/**
 * An event source adapter: one host observer (the open-file watcher, the `.porcelain/`
 * watcher, a Git trigger) translated into this domain's vocabulary.
 *
 * Declared here, connected by `RT-005`. `category` is the source's authority: a source may
 * only publish changes in its own category, so a filesystem watcher cannot start announcing
 * Review facts and no consumer has to guess which observer a change really came from.
 * `observe` returns its own teardown, which is how a source's watchers are released when the
 * publisher stops.
 */
export type SessionChangeSource = {
  readonly category: SessionChangeCategory
  readonly observe: (emit: (change: SessionChange) => void) => () => void
}

/** How a session receives the frames it is entitled to. */
export type SessionChangeSubscriber = {
  readonly deliver: (frame: SessionChangeFrame) => void
}

export type SessionChangeSubscription = {
  /**
   * Scope this subscription to one project. Called when the session declares the project it
   * is watching; until then the subscription receives nothing.
   */
  readonly scopeToProject: (projectPath: string | undefined) => void
  /** The project currently in scope, or `undefined` while the subscription is unscoped. */
  readonly projectPath: () => string | undefined
  /** Drop the subscription. Idempotent — a closed socket may report closed more than once. */
  readonly close: () => void
}

/** Expected outcomes of publishing; a rejected change is ordinary behavior, not a defect. */
export type SessionPublishOutcome =
  | { ok: true; delivered: number }
  | {
      ok: false
      error:
        | { code: 'session.invalid-change' }
        | {
            code: 'session.source-category-mismatch'
            source: SessionChangeCategory
            change: SessionChangeCategory
          }
    }

export type SessionChangePublisher = {
  readonly subscribe: (subscriber: SessionChangeSubscriber) => SessionChangeSubscription
  /** Publish an untrusted change fact. Returns how many subscriptions it reached. */
  readonly publish: (change: unknown) => SessionPublishOutcome
  /** Connect a source adapter; the returned teardown releases the source's observation. */
  readonly connectSource: (source: SessionChangeSource) => () => void
  readonly subscriptionCount: () => number
}

type SubscriptionState = {
  subscriber: SessionChangeSubscriber
  projectPath: string | undefined
  nextSequence: number
  open: boolean
}

export function createSessionChangePublisher({ epoch }: { epoch: string }): SessionChangePublisher {
  const subscriptions = new Set<SubscriptionState>()

  function deliverTo(state: SubscriptionState, change: SessionChange): void {
    // The daemon's own output still crosses the contract: an unparseable frame here is a
    // defect in this module, not an expected outcome, so it throws rather than shipping a
    // frame no client agreed to accept.
    const frame = sessionChangeFrameSchema.parse({
      t: 'session:change',
      epoch,
      sequence: state.nextSequence,
      change,
    })
    state.nextSequence += 1
    state.subscriber.deliver(frame)
  }

  function publish(change: unknown): SessionPublishOutcome {
    const parsed = sessionChangeSchema.safeParse(change)
    if (!parsed.success) return { ok: false, error: { code: 'session.invalid-change' } }

    let delivered = 0
    for (const state of subscriptions) {
      if (!state.open || state.projectPath !== parsed.data.projectPath) continue
      deliverTo(state, parsed.data)
      delivered += 1
    }
    return { ok: true, delivered }
  }

  return {
    subscribe(subscriber) {
      const state: SubscriptionState = {
        subscriber,
        projectPath: undefined,
        nextSequence: 0,
        open: true,
      }
      subscriptions.add(state)
      return {
        scopeToProject(projectPath) {
          state.projectPath = projectPath
        },
        projectPath() {
          return state.projectPath
        },
        close() {
          state.open = false
          subscriptions.delete(state)
        },
      }
    },

    publish,

    connectSource(source) {
      return source.observe((change) => {
        const category = sessionChangeCategory(change)
        if (category !== source.category) {
          // A source publishing outside its category is a wiring defect, and silently
          // forwarding it would make the change's origin unknowable. Refused loudly enough
          // to see in diagnostics, without taking the daemon down over one bad frame.
          console.error(
            `[daemon] session source ${source.category} published a ${category} change; refused`,
          )
          return
        }
        publish(change)
      })
    },

    subscriptionCount() {
      return subscriptions.size
    },
  }
}
