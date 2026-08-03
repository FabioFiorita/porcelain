import type { UseQueryResult } from '@tanstack/react-query'
import { useFocusEffect, useIsFocused } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DaemonError } from '@/lib/daemon/errors'
import {
  type DirEntry,
  type FileSearchResult,
  type FileView,
  hidePathMutation,
  pinnedEntriesQuery,
  pinPathMutation,
  readFileQuery,
  searchFilesQuery,
  unhidePathMutation,
  unpinPathMutation,
} from '@/lib/daemon/procedures/files'
import { useDaemonInvalidate, useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'
import { useDaemonSession } from '@/lib/daemon/session'

function useRefetchOnFocus(refetch: () => Promise<unknown>, enabled: boolean): void {
  useFocusEffect(
    useCallback(() => {
      if (enabled) refetch()
    }, [enabled, refetch]),
  )
}

export function useFilesWatch({
  dirs,
  files,
}: {
  dirs?: readonly string[]
  files?: readonly string[]
}): void {
  const { watch } = useDaemonSession()
  const enabled = (dirs?.length ?? 0) > 0 || (files?.length ?? 0) > 0
  useEffect(() => {
    if (!enabled) return
    return watch({ dirs, files })
  }, [dirs, enabled, files, watch])
}

export function usePinnedFileEntries(
  repoPath: string,
  enabled: boolean,
): UseQueryResult<DirEntry[], DaemonError> {
  const query = useDaemonQuery(pinnedEntriesQuery, repoPath, {
    enabled,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  })
  useRefetchOnFocus(query.refetch, enabled)
  return query
}

export function useFileSearch(
  repoPath: string,
  query: string,
  enabled: boolean,
): UseQueryResult<FileSearchResult[], DaemonError> {
  const trimmed = query.trim()
  return useDaemonQuery(
    searchFilesQuery,
    { query: trimmed, repoPath },
    {
      enabled: enabled && trimmed !== '',
      placeholderData: 'keepPreviousData',
      refetchOnWindowFocus: false,
      staleTime: 0,
    },
  )
}

export function useDebouncedFileQuery(value: string, delayMs = 250): string {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value)
    }, delayMs)
    return () => clearTimeout(timer)
  }, [delayMs, value])

  return debounced
}

export function useFileView(path: string, enabled: boolean): UseQueryResult<FileView, DaemonError> {
  const query = useDaemonQuery(readFileQuery, path, {
    enabled: enabled && path !== '',
    gcTime: 2 * 60_000,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  })
  const files = useMemo(() => (enabled && path !== '' ? [path] : []), [enabled, path])
  useFilesWatch({ files })
  useRefetchOnFocus(query.refetch, enabled && path !== '')
  return query
}

export type FileEntryActions = {
  hide: (path: string) => void
  pin: (path: string) => void
  unhide: (path: string) => void
  unpin: (path: string) => void
}

export function useFileEntryActions(repoPath: string | null): FileEntryActions {
  const hide = useDaemonMutation(hidePathMutation, { invalidates: ['readDir', 'pinnedEntries'] })
  const unhide = useDaemonMutation(unhidePathMutation, {
    invalidates: ['readDir', 'pinnedEntries'],
  })
  const pin = useDaemonMutation(pinPathMutation, { invalidates: ['readDir', 'pinnedEntries'] })
  const unpin = useDaemonMutation(unpinPathMutation, {
    invalidates: ['readDir', 'pinnedEntries'],
  })

  return {
    hide: (path: string): void => {
      if (repoPath !== null) hide.mutate({ path, repoPath })
    },
    pin: (path: string): void => {
      if (repoPath !== null) pin.mutate({ path, repoPath })
    },
    unhide: (path: string): void => {
      if (repoPath !== null) unhide.mutate({ path, repoPath })
    },
    unpin: (path: string): void => {
      if (repoPath !== null) unpin.mutate({ path, repoPath })
    },
  }
}

export function useInvalidateFiles(): () => void {
  const invalidate = useDaemonInvalidate()
  return useCallback(() => invalidate(['readDir', 'pinnedEntries', 'searchFiles']), [invalidate])
}

export function useFilesFocused(): boolean {
  return useIsFocused()
}
