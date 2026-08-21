/**
 * How often the roster is re-read from the daemon.
 *
 * A shell killed from another client sends this device nothing — the exit frame goes to the
 * clients attached to that PTY — so the poll is the backstop that makes an externally-killed
 * row disappear. It lives apart from the hook so the number is assertable without a daemon.
 */
export const TERMINAL_ROSTER_POLL_MS = 5_000
