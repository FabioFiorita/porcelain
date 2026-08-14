import type { ActionView } from '@porcelain/contracts/actions'
import type { Commit } from '@porcelain/contracts/git'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { useActions, useActionsSelectionStore } from '@/features/actions'
import { useFilesStore } from '@/features/files'
import { useGitLog } from '@/features/git'
import { useHistoryStore } from '@/features/history'
import { useFileSearch, useSearchStore } from '@/features/search'
import { useShellStore } from '@/features/shell/shell-store'
import type { SurfaceId } from '@/features/shell/surfaces'
import { useTabFaces } from '@/features/shell/tab-faces'
import { useIsTablet } from '@/features/shell/use-app-window'
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
  const isTablet = useIsTablet()
  const setActiveSurface = useShellStore((state) => state.setActiveSurface)
  const openSheet = useShellStore((state) => state.openSheet)
  const setSettingsSection = useShellStore((state) => state.setSettingsSection)
  const openDir = useFilesStore((state) => state.openDir)
  const openFileInViewer = useFilesStore((state) => state.openFile)
  const openCommitInHistory = useHistoryStore((state) => state.openCommit)
  const selectAction = useActionsSelectionStore((state) => state.selectAction)
  const setSearchQuery = useSearchStore((state) => state.setQuery)
  const setSearchMode = useSearchStore((state) => state.setSearchMode)
  const setFilesFace = useTabFaces((state) => state.setFiles)
  const setChangesFace = useTabFaces((state) => state.setChanges)
  const setReviewFace = useTabFaces((state) => state.setReview)

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

  const navigatePhoneSurface = useCallback(
    (surface: SurfaceId): void => {
      setActiveSurface(surface)
      switch (surface) {
        case 'files':
          setFilesFace('files')
          router.navigate('/')
          return
        case 'search':
          setFilesFace('search')
          router.navigate('/')
          return
        case 'changes':
          setChangesFace('changes')
          router.navigate('/changes')
          return
        case 'history':
          setChangesFace('history')
          router.navigate('/changes')
          return
        case 'review':
          setReviewFace('review')
          router.navigate('/review')
          return
        case 'board':
          setReviewFace('board')
          router.navigate('/review')
          return
        case 'terminal':
          router.navigate('/terminal')
          return
      }
    },
    [router, setActiveSurface, setChangesFace, setFilesFace, setReviewFace],
  )

  const openFile = useCallback(
    (result: QuickOpenFile): void => {
      close()
      if (isTablet) {
        if (result.kind === 'dir') openDir(result.path)
        else openFileInViewer(result.path)
        setActiveSurface('files')
        return
      }
      router.push({
        params: { path: pathSegments(result.path) },
        pathname: result.kind === 'dir' ? '/folder/[...path]' : '/file/[...path]',
      })
    },
    [close, isTablet, openDir, openFileInViewer, router, setActiveSurface],
  )

  const openCommand = useCallback(
    (action: ActionView): void => {
      selectAction(action.id)
      close()
      if (isTablet) setActiveSurface('terminal')
      else navigatePhoneSurface('terminal')
    },
    [close, isTablet, navigatePhoneSurface, selectAction, setActiveSurface],
  )

  const openCommit = useCallback(
    (commit: Commit): void => {
      openCommitInHistory(commit.hash)
      close()
      if (isTablet) {
        setActiveSurface('history')
        return
      }
      setChangesFace('history')
      router.push({ params: { hash: commit.hash }, pathname: '/changes/commit/[hash]' })
    },
    [close, isTablet, openCommitInHistory, router, setActiveSurface, setChangesFace],
  )

  const openGoto = useCallback(
    (destination: QuickOpenGotoRow): void => {
      close()
      if (destination.kind === 'settings') {
        setSettingsSection(destination.section)
        if (isTablet) openSheet('settings')
        else router.navigate('/settings')
        return
      }
      if (isTablet) setActiveSurface(destination.id)
      else navigatePhoneSurface(destination.id)
    },
    [
      close,
      isTablet,
      navigatePhoneSurface,
      openSheet,
      router,
      setActiveSurface,
      setSettingsSection,
    ],
  )

  const searchContents = useCallback((): void => {
    const nextQuery = query.trim()
    if (nextQuery === '') return
    close()
    setSearchMode('text')
    setSearchQuery(nextQuery)
    if (isTablet) setActiveSurface('search')
    else navigatePhoneSurface('search')
  }, [
    close,
    isTablet,
    navigatePhoneSurface,
    query,
    setActiveSurface,
    setSearchMode,
    setSearchQuery,
  ])

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
