import { FilesBrowser } from './files-browser'
import { useFilesStore } from './files-store'

/**
 * The tablet's supplementary column: the tree, one directory at a time.
 *
 * Tablet-only. This column sits beside the viewer, so it has no back affordance and no tab-bar
 * inset to clear — its way up is the breadcrumb, which the phone does not need because it has
 * a stack. Opening a file selects into the viewer column instead of pushing.
 */
export function FilesList({ active }: { active: boolean }): React.JSX.Element {
  const cursor = useFilesStore((state) => state.cursor)
  const selection = useFilesStore((state) => state.selection)
  const openDir = useFilesStore((state) => state.openDir)
  const openFile = useFilesStore((state) => state.openFile)

  return (
    <FilesBrowser
      active={active}
      dirPath={cursor}
      onOpenCrumb={openDir}
      onOpenDir={openDir}
      onOpenFile={openFile}
      selectedPath={selection}
    />
  )
}
