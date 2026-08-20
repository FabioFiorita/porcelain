import type { ActionView } from '@porcelain/contracts/actions'
import type { Commit } from '@porcelain/contracts/git'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { useActions, useActionsSelectionStore } from '@/features/actions'
import { useGitLog } from '@/features/git'
import { useHistoryStore } from '@/features/history'
import { useFileSearch, useSearchStore } from '@/features/search'
import { shellSheetHref } from '@/features/shell/shell-sheets'
import { useShellStore } from '@/features/shell/shell-store'
import type { SurfaceId } from '@/features/shell/surfaces'
import { pathSegments } from '@/lib/path-identities'

import {
  gotoRows,
  groupsLabelled,
  matchCommands,
  matchCommits,
  type QuickOpenFile,
  type QuickOpenGotoRow,
} from './quick-open-matching'

const DEBOUNCE_MS = 150

export type QuickOpenModel = {
  query: string
  setQuery: (query: string) => void
  files: QuickOpenFile[]
  commands: ActionView[]
  commits: Commit[]
  goto: QuickOpenGotoRow[]
  labelled: boolean
  searching: boolean
  noResults: boolean
  error: Error | null
  openFile: (result: QuickOpenFile) => void
  openCommand: (action: ActionView) => void
  openCommit: (commit: Commit) => void
  openGoto: (destination: QuickOpenGotoRow) => void
  searchContents: () => void
}

function asError(error: unknown): Error | null {
  if (error === null || error === undefined) return null
  return error instanceof Error ? error : new Error(String(error))
}

/** Shared phone/tablet behavior for the one-line navigation surface. */
export function useQuickOpen(open: boolean, onClose: () => void): QuickOpenModel {
  const router = useRouter()
  const setActiveSurface = useShellStore((state) => state.setActiveSurface)
  const setSettingsSection = useShellStore((state) => state.setSettingsSection)
  const openCommitInHistory = useHistoryStore((state) => state.openCommit)
  const selectAction = useActionsSelectionStore((state) => state.selectAction)
  const setSearchQuery = useSearchStore((state) => state.setQuery)
  const setSearchMode = useSearchStore((state) => state.setSearchMode)

  const [query, setQuery] = useState('')
  const [settledQuery, setSettledQuery] = useState('')
  const fileSearch = useFileSearch(settledQuery, open)
  const actionRead = useActions(open)
  const gitRead = useGitLog(open)

  useEffect(() => {
    if (open) return
    setQuery('')
    setSettledQuery('')
  }, [open])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      setSettledQuery(query)
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [open, query])

  const files = fileSearch.results
  const commands = useMemo(
    () => matchCommands(query, actionRead.actions),
    [actionRead.actions, query],
  )
  const commits = useMemo(
    () => matchCommits(query, gitRead.commits ?? []),
    [gitRead.commits, query],
  )
  const goto = useMemo(() => gotoRows(query), [query])
  const kinds =
    (files.length > 0 ? 1 : 0) +
    (commands.length > 0 ? 1 : 0) +
    (commits.length > 0 ? 1 : 0) +
    (goto.length > 0 ? 1 : 0)
  const trimmed = query.trim()
  const searching =
    trimmed !== '' && (query !== settledQuery || fileSearch.isLoading || gitRead.isLoading)
  const noResults =
    trimmed !== '' &&
    !searching &&
    files.length === 0 &&
    commands.length === 0 &&
    commits.length === 0 &&
    goto.length === 0
  const error = fileSearch.error ?? asError(actionRead.error) ?? gitRead.error

  const close = useCallback((): void => {
    setQuery('')
    onClose()
  }, [onClose])

  /**
   * Every surface is a screen inside the Hub stack now, so going to one is a plain push at its
   * own route — no tab face to set first, and no `/` that means two different surfaces.
   */
  const navigateSurface = useCallback(
    (surface: SurfaceId): void => {
      setActiveSurface(surface)
      switch (surface) {
        case 'files':
          router.push('/files')
          return
        case 'search':
          router.push('/search')
          return
        case 'changes':
          router.push('/changes')
          return
        case 'history':
          router.push('/history')
          return
        case 'terminal':
          router.push('/terminal')
          return
      }
    },
    [router, setActiveSurface],
  )

  const openFile = useCallback(
    (result: QuickOpenFile): void => {
      close()
      router.push({
        params: { path: pathSegments(result.path) },
        pathname: result.kind === 'dir' ? '/folder/[...path]' : '/file/[...path]',
      })
    },
    [close, router],
  )

  const openCommand = useCallback(
    (action: ActionView): void => {
      selectAction(action.id)
      close()
      navigateSurface('terminal')
    },
    [close, navigateSurface, selectAction],
  )

  const openCommit = useCallback(
    (commit: Commit): void => {
      openCommitInHistory(commit.hash)
      close()
      router.push({ params: { hash: commit.hash }, pathname: '/changes/commit/[hash]' })
    },
    [close, openCommitInHistory, router],
  )

  const openGoto = useCallback(
    (destination: QuickOpenGotoRow): void => {
      close()
      if (destination.kind === 'settings') {
        setSettingsSection(destination.section)
        router.navigate(shellSheetHref('settings'))
        return
      }
      navigateSurface(destination.id)
    },
    [close, navigateSurface, router, setSettingsSection],
  )

  const searchContents = useCallback((): void => {
    const nextQuery = query.trim()
    if (nextQuery === '') return
    close()
    setSearchMode('text')
    setSearchQuery(nextQuery)
    navigateSurface('search')
  }, [close, navigateSurface, query, setSearchMode, setSearchQuery])

  return {
    commands,
    commits,
    error,
    files,
    goto,
    labelled: groupsLabelled(kinds),
    noResults,
    openCommand,
    openCommit,
    openFile,
    openGoto,
    query,
    searchContents,
    searching,
    setQuery,
  }
}
