import { View } from 'react-native'

import { useSurfaceOpen } from '@/features/shell/use-surface-open'

import { REPO_ROOT } from './file-paths'
import { FilesBrowser } from './files-browser'

/**
 * The Files surface on phone: the repo root's contents, under the header `SurfaceScreen` draws.
 *
 * Folders and files both push a route onto this tab's stack, so the interactive pop gesture, the
 * Android hardware back button, and re-tap-to-root all come from the navigator rather than from
 * a store flag imitating it. The tablet's Surfaces panel walks folders with a cursor instead —
 * see `files-surface-panel.tsx` — because a panel beside the viewer has no stack of its own, and
 * a folder pushed from there would land a directory in the viewer.
 */
export function FilesPhoneScreen({ active }: { active: boolean }): React.JSX.Element {
  const open = useSurfaceOpen()

  return (
    <View className="flex-1" testID="porcelain-phone-surface-files">
      <FilesBrowser
        active={active}
        dirPath={REPO_ROOT}
        onOpenDir={open.folder}
        onOpenFile={open.file}
      />
    </View>
  )
}
