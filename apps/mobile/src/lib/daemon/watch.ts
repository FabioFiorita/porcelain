import { useEffect } from 'react'

import { daemonSession } from './session'

/**
 * Tell the daemon which files and directories this screen is looking at, so it watches them
 * and pushes when the agent writes underneath you.
 *
 * The daemon only watches what a session explicitly registers — a healthy socket is not a
 * promise of freshness. Interests ride the shared session runtime (`registerWatchInterest`);
 * domain change notifications invalidate the authoritative queries in `provider.tsx`.
 *
 * Watches are re-sent after every ready (including reconnect). Registering is idempotent:
 * several screens may watch the same path, and the runtime unions them by reference count.
 */
export function useDaemonWatch(paths: {
  files?: readonly string[]
  dirs?: readonly string[]
}): void {
  // The path arrays are usually fresh literals on every render; keying the effect on their
  // contents rather than their identity is what stops it re-registering every frame.
  const fileKey = (paths.files ?? []).join('\n')
  const dirKey = (paths.dirs ?? []).join('\n')

  useEffect(() => {
    const files = fileKey === '' ? [] : fileKey.split('\n')
    const dirs = dirKey === '' ? [] : dirKey.split('\n')
    if (files.length === 0 && dirs.length === 0) return
    return daemonSession.registerWatchInterest({ dirs, files })
  }, [dirKey, fileKey])
}
