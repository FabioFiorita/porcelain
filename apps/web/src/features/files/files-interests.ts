import {
  createFilesInterest,
  type FilesInterest,
  type FilesInterestHandle,
} from '@porcelain/client-runtime/files'
import { primary } from '@renderer/lib/daemon'
import { environmentSessionFor } from '@renderer/lib/environment-sessions'
import { useHubRepoPath, useHubRepoTarget } from '@renderer/stores/hub-repo'
import { type Pane, useTabsStore } from '@renderer/stores/tabs'
import { useTreeDirsStore } from '@renderer/stores/tree-dirs'
import { useEffect, useMemo, useRef } from 'react'
import { projectRelativeFromAbsolute, treePathFromAbsolute } from './files-path'

/** The Viewer's open files, deduplicated and ordered so an unchanged set compares equal. */
function openFilePaths(panes: readonly Pane[]): string[] {
  const paths = new Set<string>()
  for (const pane of panes) {
    for (const tab of pane.tabs) {
      if (tab.kind === 'file') paths.add(tab.path)
    }
  }
  return [...paths].sort()
}

/**
 * Single Files interest bridge: open Viewer files + expanded tree dirs → RT-003 watches.
 * Mounted once from AppShell. Session runtime no longer registers watch interests.
 */
export function useFilesInterestBridge(): void {
  const repoPath = useHubRepoPath()
  const target = useHubRepoTarget()
  const owner = environmentSessionFor(target?.environmentId ?? null)
  // Reactive selectors — never snapshot-only getState(); tab open / dir expand must recompute.
  const panes = useTabsStore((s) => s.panes)
  const dirs = useTreeDirsStore((s) => s.dirs)

  const interestKey = useMemo(() => {
    const files = openFilePaths(panes).join('\n')
    const dirList = [...dirs].sort().join('\n')
    return `${files}\u0000${dirList}`
  }, [panes, dirs])

  const desired = useMemo(() => {
    const [files = '', dirPart = ''] = interestKey.split('\u0000')
    return {
      files: files === '' ? [] : files.split('\n'),
      dirs: dirPart === '' ? [] : dirPart.split('\n'),
    }
  }, [interestKey])

  const facadeRef = useRef<FilesInterest | null>(null)
  const handlesRef = useRef<FilesInterestHandle[]>([])

  // Project change or unmount: dispose terminal facade; construct new for new project.
  useEffect(() => {
    for (const handle of handlesRef.current) handle.release()
    handlesRef.current = []
    facadeRef.current?.dispose()
    facadeRef.current = null

    if (repoPath === null || owner === null) return

    facadeRef.current = createFilesInterest(repoPath, {
      registerWatchInterest: (interest) =>
        (owner.session?.runtime ?? primary.runtime).registerWatchInterest(interest),
    })

    return () => {
      for (const handle of handlesRef.current) handle.release()
      handlesRef.current = []
      facadeRef.current?.dispose()
      facadeRef.current = null
    }
  }, [owner, repoPath])

  // Recompute interests when open files or expanded dirs change.
  useEffect(() => {
    const facade = facadeRef.current
    if (facade === null || repoPath === null) return

    for (const handle of handlesRef.current) handle.release()
    handlesRef.current = []

    for (const abs of desired.files) {
      const rel = projectRelativeFromAbsolute(repoPath, abs)
      if (rel === null) continue
      const handle = facade.addFile(rel)
      if (handle) handlesRef.current.push(handle)
    }
    for (const abs of desired.dirs) {
      const treePath = treePathFromAbsolute(repoPath, abs)
      if (treePath === null) continue
      const handle = facade.addDirectory(treePath)
      if (handle) handlesRef.current.push(handle)
    }
  }, [repoPath, desired])
}
