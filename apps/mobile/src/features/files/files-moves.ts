import { isFilesProjectRelativePath } from '@porcelain/contracts/files'
import { usePathname, useRouter } from 'expo-router'
import { useRef } from 'react'
import { create } from 'zustand'
import { useHubRepoPath } from '@/features/projects'
import { useActiveEnvironment } from '@/features/remote'
import { pathSegments } from './file-paths'
import { useFileWrites } from './files-mutations'
import { useFilesStore } from './files-store'

type MoveSource = { environmentId: string; repoPath: string; paths: string[] }
export const useFilesMoveStore = create<{ cut: MoveSource | null; busy: boolean }>(() => ({
  cut: null,
  busy: false,
}))

export function planRelativeMoves(paths: string[], destination: string) {
  if (
    (destination !== '' && !isFilesProjectRelativePath(destination)) ||
    paths.some((path) => !isFilesProjectRelativePath(path))
  ) {
    throw new Error('Choose paths inside this worktree.')
  }
  const unique = [...new Set(paths)]
  const plan = unique
    .filter((path) => !unique.some((parent) => path.startsWith(`${parent}/`)))
    .map((from) => {
      if (destination === from || destination.startsWith(`${from}/`))
        throw new Error('A folder cannot be moved into itself.')
      const name = from.split('/').at(-1)
      return { from, to: destination === '' ? `${name}` : `${destination}/${name}` }
    })
    .filter(({ from, to }) => from !== to)
  if (new Set(plan.map(({ to }) => to)).size !== plan.length)
    throw new Error('Selected files have the same name.')
  return plan
}

export function useFilesMoves() {
  const environment = useActiveEnvironment()
  const repoPath = useHubRepoPath()
  const clipboard = useFilesMoveStore((s) => s.cut)
  const busy = useFilesMoveStore((s) => s.busy)
  const writes = useFileWrites()
  const router = useRouter()
  const pathname = usePathname()
  const current = useRef({ environmentId: environment?.id, repoPath, pathname })
  current.current = { environmentId: environment?.id, repoPath, pathname }
  const owns = (source: MoveSource) =>
    source.environmentId === environment?.id && source.repoPath === repoPath
  const move = async (destination: string, source = useFilesMoveStore.getState().cut) => {
    if (!source || !owns(source) || useFilesMoveStore.getState().busy) return
    const plan = planRelativeMoves(source.paths, destination)
    let clipboardSource = source === useFilesMoveStore.getState().cut ? source : null
    useFilesMoveStore.setState({ busy: true })
    try {
      for (const { from, to } of plan) {
        if (
          current.current.environmentId !== source.environmentId ||
          current.current.repoPath !== source.repoPath
        ) {
          throw new Error('The worktree changed. Remaining files are still in the clipboard.')
        }
        await writes.move(from, to)
        if (
          current.current.environmentId === source.environmentId &&
          current.current.repoPath === source.repoPath
        ) {
          const selection = useFilesStore.getState().selection
          if (selection === from || selection?.startsWith(`${from}/`)) {
            const next = to + selection.slice(from.length)
            useFilesStore.getState().openFile(next)
            if (current.current.pathname.startsWith('/file/'))
              router.replace({ pathname: '/file/[...path]', params: { path: pathSegments(next) } })
          }
        }
        if (clipboardSource && clipboardSource === useFilesMoveStore.getState().cut) {
          clipboardSource = {
            ...clipboardSource,
            paths: clipboardSource.paths.filter(
              (path) => path !== from && !path.startsWith(`${from}/`),
            ),
          }
          useFilesMoveStore.setState({
            cut: clipboardSource.paths.length === 0 ? null : clipboardSource,
          })
        }
      }
      if (clipboardSource === useFilesMoveStore.getState().cut)
        useFilesMoveStore.setState({ cut: null })
    } finally {
      useFilesMoveStore.setState({ busy: false })
    }
  }
  return {
    canPaste: !!clipboard && owns(clipboard) && !busy,
    cut: (paths: string[]) => {
      if (environment && repoPath && !busy)
        useFilesMoveStore.setState({ cut: { environmentId: environment.id, repoPath, paths } })
    },
    paste: (destination: string) => move(destination),
    move,
  }
}
