import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ChangesDiffView } from '@/features/changes/changes-diff-view'
import { useChangesFlow } from '@/features/changes/use-changes'
import { useTabBarInset } from '@/features/shell/tab-bar-inset'

/**
 * One file's diff, pushed over the Changes list.
 *
 * The repo-relative path is a rest segment because it carries slashes; Expo Router hands the
 * segments back as an array, which rejoins to exactly the path git gave us.
 */
export default function ChangesFileRoute(): React.JSX.Element {
  const { path } = useLocalSearchParams<{ path: string[] }>()
  const focused = useIsFocused()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const bottomInset = useTabBarInset()
  // The base ref identifies a branch-scope diff, and it comes from the same read the list
  // rendered before it pushed us — already cached, so this costs nothing.
  const { base } = useChangesFlow(focused)

  return (
    <ChangesDiffView
      active={focused}
      base={base}
      bottomInset={bottomInset}
      filePath={path.join('/')}
      topInset={Math.max(insets.top, 8)}
      onBack={() => {
        router.back()
      }}
    />
  )
}
