import { List, Section, Text } from '@expo/ui/swift-ui'
import { font, listStyle } from '@expo/ui/swift-ui/modifiers'
import { router, Stack, useLocalSearchParams } from 'expo-router'

import { DaemonGate } from '@/components/daemon-gate'
import { HeaderToolbar } from '@/components/header-toolbar'
import { ListLinkRow } from '@/components/list-link-row'
import { ScreenHost } from '@/components/screen-host'
import { FlowGroupList } from '@/features/changes/components/flow-group-list'
import { QueryNotice } from '@/features/changes/components/query-notice'
import { useCommitMessage, useScopeFlow } from '@/features/changes/data/queries'
import { shortHash, splitMessage } from '@/features/changes/lib/format'
import { firstParam } from '@/features/changes/lib/scope'
import { footnote, secondary } from '@/theme/modifiers'

const headline = font({ textStyle: 'headline' })

/**
 * One historical commit: its message, then the same flow-grouped file list the working tree
 * uses. Commit scope has no staging, reviewed marks or discard — the components simply are not
 * given them.
 */
export function CommitDetailScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ author?: string; date?: string; hash: string }>()
  const hash = firstParam(params.hash)
  const author = firstParam(params.author)
  const date = firstParam(params.date)

  return (
    <>
      <Stack.Screen options={{ title: shortHash(hash) }} />
      <DaemonGate requires="repo">
        <CommitBody author={author} date={date} hash={hash} />
      </DaemonGate>
      <HeaderToolbar />
    </>
  )
}

function CommitBody({
  author,
  date,
  hash,
}: {
  author: string
  date: string
  hash: string
}): React.JSX.Element {
  const message = useCommitMessage(hash)
  const flow = useScopeFlow({ hash, type: 'commit' })
  const groups = flow.data ?? []
  const { body, subject } = splitMessage(message.data ?? '')

  return (
    <ScreenHost>
      <List modifiers={[listStyle('insetGrouped')]}>
        <Section>
          <Text modifiers={[headline]}>{subject === '' ? shortHash(hash) : subject}</Text>
          {body === '' ? null : <Text modifiers={[footnote, secondary]}>{body}</Text>}
          {author === '' && date === '' ? null : (
            <Text modifiers={[footnote, secondary]}>
              {[author, date].filter(Boolean).join(' · ')}
            </Text>
          )}
        </Section>
        {groups.length === 0 ? null : (
          <Section title="Review">
            <ListLinkRow
              detail="Read every changed file in flow order"
              icon="text.alignleft"
              label="Read changes"
              onPress={(): void => {
                router.push({ params: { hash, scope: 'commit' }, pathname: '/reading' })
              }}
            />
          </Section>
        )}
        {groups.length === 0 ? (
          <Section>
            <QueryNotice
              description="This commit touched no files the daemon can group."
              error={flow.error ?? message.error}
              isPending={flow.isPending}
              onRetry={(): void => {
                flow.refetch()
              }}
              symbol="doc.text"
              title="No files"
            />
          </Section>
        ) : (
          <FlowGroupList
            groups={groups}
            onSelect={(path: string): void => {
              router.push({ params: { hash, path, scope: 'commit' }, pathname: '/file' })
            }}
          />
        )}
      </List>
    </ScreenHost>
  )
}
