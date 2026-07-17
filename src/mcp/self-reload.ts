import { realpathSync, statSync } from 'node:fs'

export interface WatchServerBinaryOptions {
  /** Poll interval for mtime checks. Default 2s — fine for post-upgrade reconnect. */
  pollMs?: number
}

/**
 * When Porcelain upgrades (daemon boot re-copies ~/.porcelain/mcp/server.js, or
 * the Mac app refreshes the same path), long-lived agent MCP sessions still run
 * the *old* process with the old tool list — tools/list_changed cannot invent
 * tools that only exist in the new binary. Exit cleanly so the agent harness
 * restarts `node …/server.js` and picks up the new tools (e.g. set_loop_evidence).
 *
 * Polls mtime (not fs.watch): copyFile in-place is what ensureMcpServer does, and
 * watch events for that are platform-flaky; a 2s poll is enough after a daemon
 * upgrade. Best-effort: a missing path is a no-op.
 */
export function watchServerBinaryForUpgrade(
  serverPath: string | undefined = process.argv[1],
  exit: (code: number) => void = (code) => process.exit(code),
  log: (msg: string) => void = (msg) => {
    process.stderr.write(`${msg}\n`)
  },
  options: WatchServerBinaryOptions = {},
): (() => void) | null {
  if (serverPath === undefined || serverPath === '') return null

  let resolved: string
  try {
    resolved = realpathSync(serverPath)
  } catch {
    resolved = serverPath
  }

  let lastMtime: number
  try {
    lastMtime = statSync(resolved).mtimeMs
  } catch {
    return null
  }

  const pollMs = options.pollMs ?? 2000
  const timer = setInterval(() => {
    try {
      const next = statSync(resolved).mtimeMs
      if (next === lastMtime) return
      lastMtime = next
    } catch {
      // Mid-replace the file can briefly disappear; treat as upgrade.
    }
    log('porcelain-mcp: server binary updated; exiting so the client reloads tools')
    clearInterval(timer)
    exit(0)
  }, pollMs)
  // Don't keep the process alive solely for the poller (stdio MCP exits when stdin ends).
  timer.unref?.()

  return () => {
    clearInterval(timer)
  }
}
