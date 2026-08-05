import { useIsFocused, useRouter } from 'expo-router'
import { View } from 'react-native'

import { PhoneHeader } from '@/features/shell/phone-header'
import { useTabBarInset } from '@/features/shell/tab-bar-inset'

import { pathSegments } from './file-paths'
import { SearchPanel } from './search-panel'

/**
 * The Search face of the Files tab on phone.
 *
 * A result opens onto the same stack the tree pushes onto, so backing out of a searched file
 * lands on the search that found it — not on the tree it happens to live in.
 */
export function SearchPhoneScreen(): React.JSX.Element {
  const focused = useIsFocused()
  const router = useRouter()
  const bottomInset = useTabBarInset()

  return (
    <View className="flex-1 bg-background" testID="porcelain-phone-surface-search">
      {/* The bolt opens Search's own companion — recent queries, not Files' pins and notes. */}
      <PhoneHeader companionSurface="search" title="Search" />
      <SearchPanel
        active={focused}
        bottomInset={bottomInset}
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
