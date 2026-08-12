import { useIsFocused } from 'expo-router'
import { useEffect } from 'react'

import { type HistorySelection, useHistoryStore } from './history-store'

/**
 * Report what this screen is showing into the store while it is focused.
 *
 * The phone reaches these screens by pushing routes, so the store is not driving navigation
 * there — but the companion sheet still has to know which commit and file are being read, and
 * it cannot see into a pushed screen. The tablet's viewer writes the same field directly.
 *
 * Only the detail screens call this. The list deliberately does not reset it: the companion
 * opens from the list's header, so a reset there would empty the very panel it feeds.
 */
export function useHistoryFocus(selection: HistorySelection): void {
  const focused = useIsFocused()
  const hash = selection?.hash ?? null
  const kind = selection?.kind ?? null
  const path = selection !== null && selection.kind === 'file' ? selection.path : null

  useEffect(() => {
    if (!focused) return
    const store = useHistoryStore.getState()
    if (hash === null || kind === null) store.clear()
    else if (kind === 'file' && path !== null) store.openFile(hash, path)
    else if (kind === 'all') store.openAll(hash)
    else store.openCommit(hash)
    // Primitives, not the object: a fresh `{ kind, hash }` every render would re-run this
    // effect on every render and fight the store it writes to.
  }, [focused, hash, kind, path])
}
