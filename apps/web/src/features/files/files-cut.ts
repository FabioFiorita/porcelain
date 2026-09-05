import { type HubTarget, sameHubTarget } from '@porcelain/client-runtime/projects'
import { useHubRepoTarget } from '@renderer/stores/hub-repo'
import { useRevealStore } from '@renderer/stores/reveal'
import { useSelectionStore } from '@renderer/stores/selection'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { create } from 'zustand'
import { hasUnsavedFiles } from './files-editing'
import { useFilesActions } from './files-mutations'
import {
  normalizeProjectRoot,
  projectRelativeFromAbsolute,
  treePathFromAbsolute,
} from './files-path'

export const useFilesCutStore = create<{
  target: HubTarget | null
  paths: string[]
  busy: boolean
}>(() => ({ target: null, paths: [], busy: false }))

export function planFileMoves(
  root: string,
  paths: string[],
  destination: string,
): { from: string; to: string }[] {
  const dir = normalizeProjectRoot(destination)
  if (treePathFromAbsolute(root, dir) === null) throw new Error('Choose a folder in this worktree.')
  const unique = [...new Set(paths.map(normalizeProjectRoot))]
  const sources = unique.filter(
    (path) => !unique.some((parent) => path !== parent && path.startsWith(`${parent}/`)),
  )
  const moves = sources
    .map((from) => {
      if (projectRelativeFromAbsolute(root, from) === null)
        throw new Error('Choose an entry in this worktree.')
      if (dir === from || dir.startsWith(`${from}/`))
        throw new Error('A folder cannot be moved into itself.')
      return { from, to: `${dir}/${from.slice(from.lastIndexOf('/') + 1)}` }
    })
    .filter(({ from, to }) => from !== to)
  if (new Set(moves.map(({ to }) => to)).size !== moves.length)
    throw new Error('Selected entries have the same name. Move them separately.')
  return moves
}

export function useFilesCut(): {
  cut: (paths: string[]) => void
  paste: (destination: string, source?: { target: HubTarget; paths: string[] }) => Promise<void>
  canPaste: boolean
} {
  const target = useHubRepoTarget()
  const clipboard = useFilesCutStore()
  const { rename } = useFilesActions()
  const canPaste =
    target !== null &&
    sameHubTarget(target, clipboard.target) &&
    clipboard.paths.length > 0 &&
    !clipboard.busy
  return {
    canPaste,
    cut: (paths) => {
      if (target && !useFilesCutStore.getState().busy) useFilesCutStore.setState({ target, paths })
    },
    paste: async (destination, source) => {
      const stored = useFilesCutStore.getState()
      const current = source ? { ...source, busy: stored.busy } : stored
      if (!target || current.busy || !sameHubTarget(target, current.target)) return
      const moves = planFileMoves(target.path, current.paths, destination)
      if (
        hasUnsavedFiles(
          target,
          moves.map(({ from }) => from),
        )
      )
        throw new Error('Wait for the open files to finish saving, then paste again.')
      useFilesCutStore.setState({ busy: true })
      try {
        for (const { from, to } of moves) {
          await rename(from, to)
          useTabsStore.setState((state) => ({
            panes: state.panes.map((pane) => {
              let activeTabId = pane.activeTabId
              const tabs = pane.tabs.map((tab) => {
                const path = normalizeProjectRoot(tab.path)
                if (
                  tab.kind !== 'file' ||
                  !sameHubTarget(tab.target ?? null, target) ||
                  !(path === from || path.startsWith(`${from}/`))
                )
                  return tab
                const nextPath = to + path.slice(from.length)
                const id = tabId('file', nextPath, target)
                if (activeTabId === tab.id) activeTabId = id
                return { ...tab, id, path: nextPath }
              })
              return { ...pane, tabs, activeTabId }
            }),
          }))
          if (!source)
            useFilesCutStore.setState((s) => ({
              paths: s.paths.filter((path) => {
                const normalized = normalizeProjectRoot(path)
                return normalized !== from && !normalized.startsWith(`${from}/`)
              }),
            }))
          useRevealStore.getState().reveal(to)
        }
        if (!source) useFilesCutStore.setState({ paths: [], target: null })
        useSelectionStore.getState().clear()
        useSelectionStore.getState().setActive(null)
      } finally {
        useFilesCutStore.setState({ busy: false })
      }
    },
  }
}
