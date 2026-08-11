import { useState } from 'react'
import { copyText } from '@/lib/clipboard'
import { gitCommitMessageQuery } from '@/lib/daemon/procedures/changes'
import { useDaemonFetch } from '@/lib/daemon/queries'
import { useActiveRepo } from '@/lib/daemon/repo'

import { shortHash } from './commit-message'

export type CommitActions = {
  copyHash: (hash: string) => void
  copyMessage: (hash: string) => void
  /** What the last action did, for the surface to print. Null until one runs. */
  status: { text: string; failed: boolean } | null
  clearStatus: () => void
}

/**
 * Copy a commit's SHA or its full message, the pair the web row's context menu offers.
 *
 * A pasteboard write gives no visible feedback of its own, and the message form is a daemon
 * round trip that can fail — so both report on a status line rather than leaving a tap that
 * silently did nothing.
 */
export function useCommitActions(): CommitActions {
  const repo = useActiveRepo()
  const fetch = useDaemonFetch()
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
      if (repo === null) return
      fetch(gitCommitMessageQuery, { hash, repoPath: repo.path })
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
