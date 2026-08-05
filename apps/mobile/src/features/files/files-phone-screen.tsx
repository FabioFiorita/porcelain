import { useIsFocused, useRouter } from 'expo-router'
import { View } from 'react-native'

import { PhoneHeader } from '@/features/shell/phone-header'
import { useTabBarInset } from '@/features/shell/tab-bar-inset'

import { pathSegments, REPO_ROOT } from './file-paths'
import { FilesBrowser } from './files-browser'

/**
 * The Files tab root on phone: the header and the repo root's contents.
 *
 * Folders and files both push a route onto this tab's stack, so the interactive pop gesture,
 * the Android hardware back button, and re-tap-to-root all come from the navigator rather than
 * from a store flag imitating it. The tablet keeps the store-driven cursor its SplitView
 * columns need — one surface, two navigation models, each native to its form factor.
 */
export function FilesPhoneScreen(): React.JSX.Element {
  const focused = useIsFocused()
  const router = useRouter()
  const bottomInset = useTabBarInset()

  return (
    <View className="flex-1 bg-background" testID="porcelain-phone-surface-files">
      <PhoneHeader companionSurface="files" title="Files" />
      <FilesBrowser
        active={focused}
        bottomInset={bottomInset}
        dirPath={REPO_ROOT}
        onOpenDir={(path) => {
          router.push({ params: { path: pathSegments(path) }, pathname: '/folder/[...path]' })
        }}
        onOpenFile={(path) => {
          router.push({ params: { path: pathSegments(path) }, pathname: '/file/[...path]' })
        }}
      />
    </View>
  )
}
