import { createFilesInterest } from '@porcelain/client-runtime/files'
import { useEffect } from 'react'
import { useActiveProject } from '@/features/projects'
import { isPaired } from '@/lib/daemon/environment'
import { useActiveEnvironment } from '@/lib/daemon/environments-store'
import { daemonSession } from '@/lib/daemon/session'

/** Watch the active Files browser directory through the shared session interest facade. */
export function useFilesDirectoryInterest(relative: string, enabled: boolean): void {
  const environment = useActiveEnvironment()
  const project = useActiveProject()
  const environmentId = environment?.id ?? null
  const repoPath = project?.path ?? null
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
  const project = useActiveProject()
  const environmentId = environment?.id ?? null
  const repoPath = project?.path ?? null
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
