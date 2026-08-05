import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { pathFromSegments, pathSegments } from '@/features/files/file-paths'
import { FilesBrowser } from '@/features/files/files-browser'
import { useTabBarInset } from '@/features/shell/tab-bar-inset'

/**
 * One directory, pushed over the tree.
 *
 * The repo-relative path is a rest segment because it carries slashes; Expo Router hands the
 * segments back as an array, which rejoins to exactly the path the parent listing gave us.
 */
export default function FilesFolderRoute(): React.JSX.Element {
  const { path } = useLocalSearchParams<{ path: string[] }>()
  const focused = useIsFocused()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const bottomInset = useTabBarInset()
  const dirPath = pathFromSegments(path)

  return (
    <View className="flex-1 bg-background" testID="porcelain-files-folder-screen">
      <FilesBrowser
        active={focused}
        bottomInset={bottomInset}
        dirPath={dirPath}
        topInset={Math.max(insets.top, 8)}
        onBack={() => {
          router.back()
        }}
        onOpenDir={(next) => {
          router.push({ params: { path: pathSegments(next) }, pathname: '/folder/[...path]' })
        }}
        onOpenFile={(next) => {
          router.push({ params: { path: pathSegments(next) }, pathname: '/file/[...path]' })
        }}
      />
    </View>
  )
}
