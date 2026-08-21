import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { DiffView } from '@/features/diff/diff-view'
import { pathSegments } from '@/features/files'
import { useHistoryFocus } from '@/features/history/use-history'

/**
 * One file's diff as of a commit, pushed over that commit's file list.
 *
 * The repo-relative path is a rest segment because it carries slashes; Expo Router hands the
 * segments back as an array, which rejoins to exactly the path git gave us.
 */
export default function HistoryCommitFileRoute(): React.JSX.Element {
  const { hash, path } = useLocalSearchParams<{ hash: string; path: string[] }>()
  const focused = useIsFocused()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const filePath = path.join('/')
  useHistoryFocus({ hash, kind: 'file', path: filePath })

  return (
    <DiffView
      active={focused}
      filePath={filePath}
      source={{ hash, kind: 'commit' }}
      testID="porcelain-history-diff"
      commentTestIDPrefix="porcelain-history-comment"
      selectionTestIDPrefix="porcelain-history-selection"
      topInset={Math.max(insets.top, 8)}
      onBack={() => {
        router.back()
      }}
      onOpenFile={(next) => {
        router.push({ params: { path: pathSegments(next) }, pathname: '/file/[...path]' })
      }}
    />
  )
}
