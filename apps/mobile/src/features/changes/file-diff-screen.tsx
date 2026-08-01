import { List, Section } from '@expo/ui/swift-ui'
import { listStyle } from '@expo/ui/swift-ui/modifiers'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useMemo } from 'react'
import { useColorScheme } from 'react-native'

import { DaemonGate } from '@/components/daemon-gate'
import { HeaderToolbar } from '@/components/header-toolbar'
import { ScreenHost } from '@/components/screen-host'
import { DiffSurface } from '@/features/changes/components/diff-surface'
import { QueryNotice } from '@/features/changes/components/query-notice'
import { useCommitFileDiff, useWorkingFileDiff } from '@/features/changes/data/queries'
import { type DiffRow, fileDiffRows } from '@/features/changes/lib/diff-rows'
import { basename } from '@/features/changes/lib/format'
import { firstParam, parseScope } from '@/features/changes/lib/scope'
import { useDiffTokenizer } from '@/features/changes/lib/use-diff-tokenizer'
import type { DiffReadingScope } from '@/lib/daemon/procedures/changes'

/**
 * One file's diff, the focused counterpart to the reading screen. The path travels as a query
 * param, never a dynamic segment: repo-relative paths contain `/` and would shred the route.
 */
export function FileDiffScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ path?: string; scope?: string; hash?: string }>()
  const path = firstParam(params.path)
  const scope = parseScope(params.scope, params.hash)

  return (
    <>
      <Stack.Screen options={{ title: basename(path) }} />
      <DaemonGate requires="repo">
        <FileDiff path={path} scope={scope} />
      </DaemonGate>
      <HeaderToolbar />
    </>
  )
}

function FileDiff({ path, scope }: { path: string; scope: DiffReadingScope }): React.JSX.Element {
  const tokenizer = useDiffTokenizer(useColorScheme())
  const working = useWorkingFileDiff(path, scope.type === 'working' && path !== '')
  const commit = useCommitFileDiff(
    scope.type === 'commit' ? scope.hash : '',
    path,
    scope.type === 'commit' && path !== '',
  )
  const hunks = scope.type === 'working' ? working.data?.hunks : commit.data
  const query = scope.type === 'working' ? working : commit
  const rows = useMemo(
    (): DiffRow[] => (hunks === undefined ? [] : fileDiffRows(hunks, path)),
    [hunks, path],
  )

  if (hunks === undefined) {
    return (
      <ScreenHost>
        <List modifiers={[listStyle('insetGrouped')]}>
          <Section>
            <QueryNotice
              description="Reading this file's diff from the daemon."
              error={query.error}
              isPending={query.isPending}
              onRetry={(): void => {
                query.refetch()
              }}
              symbol="doc.text"
              title="No diff"
            />
          </Section>
        </List>
      </ScreenHost>
    )
  }

  return (
    <DiffSurface
      contentKey={`file:${scope.type === 'commit' ? scope.hash : 'working'}:${path}`}
      defaultPath={path}
      rows={rows}
      tokenizer={tokenizer}
    />
  )
}
