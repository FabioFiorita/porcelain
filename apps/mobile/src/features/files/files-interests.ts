import { createFilesInterest } from '@porcelain/client-runtime/files'
import { useEffect } from 'react'

import { isPaired } from '@/lib/daemon/environment'
import { useActiveEnvironment } from '@/lib/daemon/environments-store'
import { useActiveRepo } from '@/lib/daemon/repo'
import { daemonSession } from '@/lib/daemon/session'

/** Watch the active Files browser directory through the shared session interest facade. */
export function useFilesDirectoryInterest(relative: string, enabled: boolean): void {
  const environment = useActiveEnvironment()
  const repo = useActiveRepo()
  const environmentId = environment?.id ?? null
  const repoPath = repo?.path ?? null
  const paired = isPaired(environment)

  useEffect(() => {
    if (!enabled || !paired || environmentId === null || repoPath === null) return
    const interest = createFilesInterest(repoPath, {
      registerWatchInterest: (watch) => ({
        release: daemonSession.registerWatchInterest(watch),
      }),
    })
    const treePath = relative === '' ? '.' : relative
    const handle = interest.addDirectory(treePath)
    return () => {
      handle?.release()
      interest.dispose()
    }
  }, [enabled, environmentId, paired, relative, repoPath])
}

/** Watch the active Files viewer file through the shared session interest facade. */
export function useFilesViewerInterest(relative: string, enabled: boolean): void {
  const environment = useActiveEnvironment()
  const repo = useActiveRepo()
  const environmentId = environment?.id ?? null
  const repoPath = repo?.path ?? null
  const paired = isPaired(environment)

  useEffect(() => {
    if (!enabled || !paired || environmentId === null || repoPath === null) return
    const interest = createFilesInterest(repoPath, {
      registerWatchInterest: (watch) => ({
        release: daemonSession.registerWatchInterest(watch),
      }),
    })
    const handle = interest.addFile(relative)
    return () => {
      handle?.release()
      interest.dispose()
    }
  }, [enabled, environmentId, paired, relative, repoPath])
}
