import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ReadAllView } from '@/features/diff/read-all-view'
import { commitTitle, shortHash } from '@/features/history/commit-message'
import { useCommitMessage, useHistoryFocus } from '@/features/history/use-history'
import { useTabBarInset } from '@/features/shell/tab-bar-inset'

/**
 * A whole commit as one continuous read, pushed over the commit screen. The daemon inlines
 * every file's hunks in flow order, so this is one request rather than one per file — which is
 * what makes walking a large commit usable over a phone link.
 */
export default function HistoryCommitReadAllRoute(): React.JSX.Element {
  const { hash } = useLocalSearchParams<{ hash: string }>()
  const focused = useIsFocused()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const bottomInset = useTabBarInset()
  const message = useCommitMessage(hash, focused)
  useHistoryFocus({ hash, kind: 'all' })

  return (
    <ReadAllView
      active={focused}
      bottomInset={bottomInset}
      context={shortHash(hash)}
      scope={{ hash, type: 'commit' }}
      testID="porcelain-history-read-all"
      commentTestIDPrefix="porcelain-history-comment"
      selectionTestIDPrefix="porcelain-history-selection"
      title={commitTitle(message, hash)}
      topInset={Math.max(insets.top, 8)}
      onBack={() => {
        router.back()
      }}
    />
  )
}
