import { View } from 'react-native'

import { useSurfaceOpen } from '@/features/shell/use-surface-open'

import { SearchPanel } from './search-panel'

/**
 * The Search surface on phone.
 *
 * A result opens onto the same stack the tree pushes onto, so backing out of a searched file
 * lands on the search that found it — not on the tree it happens to live in. A content hit
 * carries the line it matched on, so the viewer opens where the reader was looking rather than
 * at the top of a two-thousand-line file.
 */
export function SearchPhoneScreen({ active }: { active: boolean }): React.JSX.Element {
  const open = useSurfaceOpen()

  return (
    <View className="flex-1" testID="porcelain-phone-surface-search">
      <SearchPanel active={active} onOpenDir={open.folder} onOpenFile={open.file} />
    </View>
  )
}
