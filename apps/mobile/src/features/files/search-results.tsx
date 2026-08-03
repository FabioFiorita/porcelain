import { ContentUnavailableView, Host, ProgressView, Text, VStack } from '@expo/ui/swift-ui'
import { frame, padding } from '@expo/ui/swift-ui/modifiers'
import { type Href, router } from 'expo-router'
import { useMemo } from 'react'
import { EntryCanvas } from '@/components/entry-canvas'
import type { EntryItem } from '@/components/entry-rows'
import { daemonErrorMessage } from '@/lib/daemon/errors'
import { useActiveRepo } from '@/lib/daemon/repo'
import { secondary } from '@/theme/modifiers'
import { useAccentColor } from '@/theme/use-accent-color'
import {
  basename,
  entryHref,
  hrefForAbsolutePath,
  parentRelativePath,
  repoRelativePath,
} from './file-paths'
import { useFileSearch } from './use-files'

/** Search hits for the Files Search face. Parent pins the query field above this list. */
export function SearchResults({ query }: { query: string }): React.JSX.Element {
  const repo = useActiveRepo()
  const results = useFileSearch(repo?.path ?? '', query, repo !== null && query.trim() !== '')
  const accentColor = useAccentColor()
  const repoPath = repo?.path ?? ''
  const items = useMemo(
    (): EntryItem[] =>
      (results.data ?? []).map((result) => ({
        depth: 0,
        key: result.path,
        kind: result.kind === 'dir' ? 'dir' : 'file',
        name: basename(result.path),
        path: result.path,
        trailing: [{ text: searchResultDetail(repoPath, result.path) }],
      })),
    [repoPath, results.data],
  )

  if (query.trim() === '') {
    return (
      <Host seedColor={accentColor} style={{ flex: 1 }}>
        <Text modifiers={[padding({ horizontal: 20, vertical: 12 }), secondary]}>
          Filename search in this repository. Re-tap Search to return to Files.
        </Text>
      </Host>
    )
  }

  if (repo === null) {
    return (
      <Host seedColor={accentColor} style={{ flex: 1 }}>
        <Text modifiers={[padding({ horizontal: 20, vertical: 12 }), secondary]}>
          Choose a project first.
        </Text>
      </Host>
    )
  }

  if (results.data === undefined) {
    if (results.error !== null && results.error !== undefined) {
      return (
        <Host seedColor={accentColor} style={{ flex: 1 }}>
          <VStack
            alignment="center"
            modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity }), padding({ all: 24 })]}
            spacing={12}
          >
            <ContentUnavailableView
              description={daemonErrorMessage(results.error)}
              systemImage="wifi.exclamationmark"
              title="Could not search files"
            />
            <Text modifiers={[secondary]}>
              Search is filename-only and stays scoped to this repository.
            </Text>
          </VStack>
        </Host>
      )
    }
    return (
      <Host seedColor={accentColor} style={{ flex: 1 }}>
        <VStack
          alignment="center"
          modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity }), padding({ all: 24 })]}
          spacing={12}
        >
          <ProgressView />
          <Text modifiers={[secondary]}>Searching filenames in the repository.</Text>
        </VStack>
      </Host>
    )
  }

  if (results.data.length === 0) {
    return (
      <Host seedColor={accentColor} style={{ flex: 1 }}>
        <ContentUnavailableView
          description="Try a different filename or folder."
          systemImage="magnifyingglass"
          title={`No files match “${query}”`}
        />
      </Host>
    )
  }

  return (
    <EntryCanvas
      contentKey={`search:${repo.path}:${query}`}
      items={items}
      onPress={(item): void => {
        if (item.kind === 'item') return
        router.push(searchHref(repo.path, item.path, item.kind))
      }}
    />
  )
}

function searchHref(repoPath: string, path: string, kind: 'dir' | 'file'): Href {
  const relative = repoRelativePath(repoPath, path)
  return relative === null || relative === ''
    ? hrefForAbsolutePath(repoPath, path, kind)
    : entryHref(kind, relative)
}

function searchResultDetail(repoPath: string, absolutePath: string): string {
  const relative = repoRelativePath(repoPath, absolutePath) ?? absolutePath
  return parentRelativePath(relative) || 'Repository root'
}
