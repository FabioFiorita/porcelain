import { useRouter } from 'expo-router'
import { useMemo } from 'react'

import { pathSegments } from '@/lib/path-identities'

/**
 * Every route a surface opens into the viewer, in one place.
 *
 * A surface list is hosted twice — as the phone's screen and as a tab of the tablet's Surfaces
 * panel — and both hosts open the same detail into the same Hub stack. Before this, each phone
 * screen spelled its own `router.push({ params: …, pathname: '/changes/file/[...path]' })` and
 * the tablet drove a store cursor into a column instead, so the two form factors reached the
 * same file by two different mechanisms and the tablet's one had no back gesture.
 *
 * Nothing here imports a feature: these are route literals and the router, so a panel that
 * belongs to Files can use it without the shell learning what a file is.
 *
 * On tablet the push lands in the centre viewer, because that is where the Hub stack is
 * mounted; on phone it lands on the stack the list is already standing on. Same call, same
 * result, and the pop gesture and the Android back button come from the navigator either way.
 */
export type SurfaceOpen = {
  /** A working-tree file, in the tree. `line` is 1-based and only comes from a search hit. */
  file: (path: string, line?: number) => void
  folder: (path: string) => void
  /** A file's diff in the Changes scope. */
  changesFile: (path: string) => void
  /** The whole change set as one continuous read. */
  changesReadAll: () => void
  commit: (hash: string) => void
  canvasDoc: (id: string) => void
  reviewComments: () => void
}

export function useSurfaceOpen(): SurfaceOpen {
  const router = useRouter()

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
      file: (path: string, line?: number) => {
        router.push({
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
        router.push('/canvas/comments')
      },
    }),
    [router],
  )
}
