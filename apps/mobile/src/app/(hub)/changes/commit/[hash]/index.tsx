import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { CommitView } from '@/features/history/commit-view'
import { useHistoryFocus } from '@/features/history/use-history'

/**
 * One commit, pushed over the History list.
 *
 * History has no tab of its own — it is the Changes tab's alternate face — so its detail
 * screens live in that tab's stack. That is what hands them the interactive pop gesture, the
 * Android hardware back button, and re-tap-to-root, all from the navigator.
 */
export default function HistoryCommitRoute(): React.JSX.Element {
  const { hash } = useLocalSearchParams<{ hash: string }>()
  const focused = useIsFocused()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  useHistoryFocus({ hash, kind: 'commit' })

  return (
    <CommitView
      active={focused}
      hash={hash}
      topInset={Math.max(insets.top, 8)}
      onBack={() => {
        router.back()
      }}
      onOpenAll={(commit) => {
        router.push({
          params: { hash: commit },
          pathname: '/changes/commit/[hash]/read-all',
        })
      }}
      onOpenFile={(commit, path) => {
        router.push({
          params: { hash: commit, path: path.split('/') },
          pathname: '/changes/commit/[hash]/file/[...path]',
        })
      }}
    />
  )
}
