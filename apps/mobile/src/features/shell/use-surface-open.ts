import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { fileTabsOwner, useFileTabsStore } from '@/features/files/file-tabs-store'
import { useFilesStore } from '@/features/files/files-store'
import { useHubRepoPath } from '@/features/projects'
import { useActiveEnvironment } from '@/features/remote'
import { pathSegments } from '@/lib/path-identities'
import { useIsTablet } from './use-app-window'

/** Shared detail navigation. Tablet files activate viewer tabs; phone files use the navigation stack. */
export type SurfaceOpen = {
  /** A working-tree file, in the tree. `line` is 1-based and only comes from a search hit. */
  file: (path: string, line?: number) => void
  folder: (path: string) => void
  /** A file's diff in the Changes scope. */
  changesFile: (path: string) => void
  /** The whole change set as one continuous read. */
  changesReadAll: () => void
  commit: (hash: string) => void
  commitFile: (hash: string, path: string) => void
  canvasDoc: (id: string) => void
  reviewComments: () => void
}

export function useSurfaceOpen(): SurfaceOpen {
  const router = useRouter()
  const tablet = useIsTablet()
  const owner = fileTabsOwner(useActiveEnvironment()?.id, useHubRepoPath())

  return useMemo(
    () => ({
      canvasDoc: (id: string) => {
        router.push({ params: { id }, pathname: '/canvas/doc/[id]' })
      },
      changesFile: (path: string) => {
        router.push({ params: { path: pathSegments(path) }, pathname: '/changes/file/[...path]' })
      },
      changesReadAll: () => {
        router.push('/changes/read-all')
      },
      commit: (hash: string) => {
        router.push({ params: { hash }, pathname: '/changes/commit/[hash]' })
      },
      commitFile: (hash: string, path: string) => {
        router.push({
          params: { hash, path: pathSegments(path) },
          pathname: '/changes/commit/[hash]/file/[...path]',
        })
      },
      file: (path: string, line?: number) => {
        useFilesStore.getState().openFile(path, line)
        if (tablet && owner) {
          useFileTabsStore.getState().open(owner, path, line)
        }
        const navigate = tablet ? router.replace : router.push
        navigate({
          params: {
            line: line === undefined ? undefined : String(line),
            path: pathSegments(path),
          },
          pathname: '/file/[...path]',
        })
      },
      folder: (path: string) => {
        router.push({ params: { path: pathSegments(path) }, pathname: '/folder/[...path]' })
      },
      reviewComments: () => {
        router.push('/changes/comments')
      },
    }),
    [router, tablet, owner],
  )
}
