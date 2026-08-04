import { useEffect, useEffectEvent, useRef } from 'react'

import { repoNotesQuery, setRepoNotesMutation } from '@/lib/daemon/procedures/notes'
import { useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'

/** Same debounce the desktop notes card uses — typing must not become one write per keystroke. */
const AUTOSAVE_DELAY_MS = 800

export type RepoNotes = {
  /** `undefined` until the first read lands; '' is a real, empty note. */
  notes: string | undefined
  /** Debounced write-through. Call on every edit; the last value in the window wins. */
  save: (next: string) => void
}

/**
 * Per-repo notes for the Files companion. Mirrors the desktop pair (`useRepoNotes` /
 * `useSetRepoNotes`): debounced autosave, flushed on unmount so dismissing the sheet
 * mid-sentence still persists.
 */
export function useRepoNotes(repoPath: string | null): RepoNotes {
  const query = useDaemonQuery(repoNotesQuery, repoPath ?? '', {
    enabled: repoPath !== null,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  })
  const mutation = useDaemonMutation(setRepoNotesMutation, { invalidates: ['repoNotes'] })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<string | null>(null)

  // Sees the current repo and mutation without re-arming the unmount flush every render.
  const flush = useEffectEvent((): void => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
    const next = pending.current
    pending.current = null
    if (next === null || repoPath === null) return
    mutation.mutate({ notes: next, repoPath })
  })

  useEffect(() => {
    return (): void => {
      flush()
    }
  }, [])

  return {
    notes: query.data,
    save: (next: string): void => {
      pending.current = next
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        flush()
      }, AUTOSAVE_DELAY_MS)
    },
  }
}
