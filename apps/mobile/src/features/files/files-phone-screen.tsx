import { View } from 'react-native'

import { useSurfaceOpen } from '@/features/shell/use-surface-open'

import { REPO_ROOT } from './file-paths'
import { FilesBrowser } from './files-browser'
import { PinnedSection } from './files-companion'

/**
 * The Files surface on phone: the same lazy expandable tree as web/tablet, under the header
 * `SurfaceScreen` draws. Files still push into the viewer; folders expand in place so pins,
 * hidden scope, and tree position remain visible together.
 */
export function FilesPhoneScreen({ active }: { active: boolean }): React.JSX.Element {
  const open = useSurfaceOpen()

  return (
    <View className="flex-1" testID="porcelain-phone-surface-files">
      <PinnedSection active={active} compact />
      <FilesBrowser
        active={active}
        dirPath={REPO_ROOT}
        onOpenDir={open.folder}
        onOpenFile={open.file}
        tree
      />
    </View>
  )
}
