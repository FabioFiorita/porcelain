import { useState } from 'react'
import { useFetchCommitMessage } from '@/features/git'
import { useHubRepoPath } from '@/features/projects'
import { copyText } from '@/lib/clipboard'

import { shortHash } from './commit-message'

export type CopyActions = {
  copyHash: (hash: string) => void
  copyMessage: (hash: string) => void
  /** What the last action did, for the surface to print. Null until one runs. */
  status: { text: string; failed: boolean } | null
  clearStatus: () => void
}

/**
 * Copy a commit's SHA or its full message, the pair the web row's context menu offers.
 * The commit message itself is read through the Git feature adapter (GIT-006).
 *
 * A pasteboard write gives no visible feedback of its own, and the message form is a daemon
 * round trip that can fail — so both report on a status line rather than leaving a tap that
 * silently did nothing.
 */
export function useCopyActions(): CopyActions {
  const repoPath = useHubRepoPath()
  const fetchCommitMessage = useFetchCommitMessage()
  const [status, setStatus] = useState<{ text: string; failed: boolean } | null>(null)

  const report = (text: string, failed: boolean): void => {
    setStatus({ failed, text })
  }

  return {
    clearStatus: () => {
      setStatus(null)
    },
    // `copyText` reports failure rather than rejecting; still attach catch so the chain never floats.
    copyHash: (hash: string): void => {
      copyText(hash)
        .then((ok) => {
          report(ok ? `Copied ${shortHash(hash)}` : 'Could not reach the pasteboard', !ok)
        })
        .catch(() => {
          report('Could not reach the pasteboard', true)
        })
    },
    copyMessage: (hash: string): void => {
      if (repoPath === null) return
      fetchCommitMessage(hash)
        .then(copyText)
        .then((ok) => {
          report(ok ? 'Copied commit message' : 'Could not reach the pasteboard', !ok)
        })
        .catch((cause: unknown) => {
          report(cause instanceof Error ? cause.message : 'Could not read the message', true)
        })
    },
    status,
  }
}
