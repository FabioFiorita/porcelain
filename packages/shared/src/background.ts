/**
 * The one promise-disposition boundary for the whole repository.
 *
 * Web, mobile, and the daemon all import this module — three near-identical copies
 * used to drift silently, so there is exactly one source now. Nothing here touches a
 * platform API, which is what lets a pure foundation package own it.
 *
 * Two dispositions, and no third:
 *
 *  - {@link settleBackground} — work whose failure is already observable elsewhere or
 *    genuinely cannot affect user intent: cache invalidation, notification fan-out,
 *    teardown, watchers, lifecycle recovery, non-user clipboard (OSC52 auto-copy), and
 *    work whose failure already has a rendered fallback.
 *    The reason is mandatory and recorded; it is not decoration.
 *  - {@link runUserAction} — anything the human asked for. Requires a non-noop error
 *    handler so a failed mutation reaches a toast, an Alert, or a status line.
 *
 * `promise.catch(() => {})` is banned outright: it is indistinguishable from a bug and
 * carries no reason. `lint-escapes` rejects no-op catch arguments, so the only way to
 * settle a promise silently is to come through here and say why.
 */

/** Why a promise may settle without anyone reading its rejection. */
export type BackgroundReason =
  | 'invalidation'
  | 'notification'
  | 'teardown'
  | 'watcher'
  | 'clipboard'
  | 'lifecycle'
  /** Failure already has a rendered or on-disk fallback the user sees instead. */
  | 'fallback'

/** Observer for settled background failures. Default is a dev-only console.debug. */
export type BackgroundObserver = (reason: BackgroundReason, error: unknown) => void

const defaultBackgroundObserver: BackgroundObserver = (reason, error) => {
  // Silent for the user by construction; still visible to whoever is debugging.
  console.debug(`[settleBackground:${reason}]`, error)
}

let backgroundObserver: BackgroundObserver = defaultBackgroundObserver

/** Test seam — pass `null` to restore the default console reporter. */
export function setBackgroundObserver(observer: BackgroundObserver | null): void {
  backgroundObserver = observer ?? defaultBackgroundObserver
}

/**
 * Settle a promise nobody awaits, on the record.
 *
 * The rejection is never rethrown and never reaches the user, but it is handed to the
 * observer with the reason that justified the silence — so "best effort" stays
 * debuggable instead of becoming a black hole. Observer failures are swallowed here
 * and nowhere else: a broken logger must not become the unhandled rejection this
 * function exists to prevent.
 */
export function settleBackground(promise: Promise<unknown>, reason: BackgroundReason): void {
  promise.catch((error: unknown) => {
    try {
      backgroundObserver(reason, error)
    } catch {
      // A failing observer is not worth floating a rejection over.
    }
  })
}

/** Phase of a boundary handler that itself failed. */
export type UserActionBoundaryPhase = 'onError' | 'onSettled'

/**
 * Low-level report when onError/onSettled throw or reject. Deterministic default is
 * console.error; tests inject a spy via {@link setUserActionReporter}.
 * May be async; failures of the reporter itself go to a guarded last-resort console path.
 */
export type UserActionReporter = (
  error: unknown,
  phase: UserActionBoundaryPhase,
) => void | PromiseLike<void>

const defaultUserActionReporter: UserActionReporter = (error, phase) => {
  console.error(`[runUserAction] ${phase} failed`, error)
}

let userActionReporter: UserActionReporter = defaultUserActionReporter

/** Test seam — pass `null` to restore the default console reporter. */
export function setUserActionReporter(reporter: UserActionReporter | null): void {
  userActionReporter = reporter ?? defaultUserActionReporter
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as PromiseLike<unknown>).then === 'function'
  )
}

/**
 * Last-resort deterministic console path when the configured reporter throws or
 * rejects. Itself guarded so a broken console never becomes an unhandled rejection.
 */
function lastResortReport(error: unknown, phase: UserActionBoundaryPhase): void {
  try {
    console.error(`[runUserAction] ${phase} reporter failed`, error)
  } catch {
    // console itself threw — nothing left to do without floating a rejection
  }
}

/**
 * Invoke the configured reporter and wait for async completion. Never rethrows;
 * reporter failures land in {@link lastResortReport}.
 */
async function reportBoundaryFailure(
  error: unknown,
  phase: UserActionBoundaryPhase,
): Promise<void> {
  try {
    const result = userActionReporter(error, phase)
    if (isThenable(result)) {
      try {
        await Promise.resolve(result)
      } catch (reportError) {
        lastResortReport(reportError, phase)
      }
    }
  } catch (reportError) {
    lastResortReport(reportError, phase)
  }
}

/**
 * Invoke a boundary callback without ever floating a rejection or rethrowing.
 * Awaits async handlers (and their failure reporting) so sequencing is exact.
 */
async function invokeBoundary(
  phase: UserActionBoundaryPhase,
  run: () => void | PromiseLike<void>,
): Promise<void> {
  try {
    const result = run()
    if (isThenable(result)) {
      try {
        await Promise.resolve(result)
      } catch (error) {
        await reportBoundaryFailure(error, phase)
      }
    }
  } catch (error) {
    await reportBoundaryFailure(error, phase)
  }
}

/**
 * Named non-silent total boundary for user-intent work. Requires an error handler so
 * React / React Native event edges can stay synchronous while rejections never float.
 *
 * Totality: sync work throw, work rejection (including `undefined`), throwing/async
 * onError, and throwing/async onSettled are all contained. Failure is tracked with an
 * explicit `didFail` flag — never `error !== undefined` — so `Promise.reject(undefined)`
 * still invokes onError. Async onError (including reporter completion) always finishes
 * before onSettled starts. Always returns void — never a Promise to the UI edge.
 *
 * Prefer owning hooks that call this (or catch + finally themselves) so JSX handlers
 * are `() => { action() }` with a void-returning total action.
 */
export function runUserAction(
  work: () => PromiseLike<unknown>,
  onError: (error: unknown) => void | PromiseLike<void>,
  onSettled?: () => void | PromiseLike<void>,
): void {
  const flow = async (): Promise<void> => {
    let didFail = false
    let failure: unknown
    try {
      await Promise.resolve(work())
    } catch (error) {
      didFail = true
      failure = error
    }

    if (didFail) {
      await invokeBoundary('onError', () => onError(failure))
    }
    if (onSettled !== undefined) {
      await invokeBoundary('onSettled', () => onSettled())
    }
  }

  // Observe the internal chain; the outer Promise is never returned to callers.
  Promise.resolve(flow()).then(
    () => undefined,
    (error: unknown) => {
      lastResortReport(error, 'onSettled')
    },
  )
}
