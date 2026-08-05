import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { pathFromSegments } from '@/features/files/file-paths'
import { FileViewer } from '@/features/files/file-viewer'
import { useTabBarInset } from '@/features/shell/tab-bar-inset'

/**
 * One file, pushed over the tree — or over a search, or over a diff, since every surface that
 * knows a repo-relative path opens the file the same way.
 */
export default function FilesFileRoute(): React.JSX.Element {
  const { path } = useLocalSearchParams<{ path: string[] }>()
  const focused = useIsFocused()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const bottomInset = useTabBarInset()

  return (
    <FileViewer
      active={focused}
      bottomInset={bottomInset}
      filePath={pathFromSegments(path)}
      topInset={Math.max(insets.top, 8)}
      onBack={() => {
        router.back()
      }}
    />
  )
}
