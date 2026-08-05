import { useFilesStore } from './files-store'
import { SearchPanel } from './search-panel'

/**
 * The tablet's supplementary column for the Search destination.
 *
 * A folder hit moves the tree's cursor rather than opening anything — a folder is not a
 * document, and the tab's answer to "where is this?" is the tree pointed at it. Switching to
 * the Files destination then shows it open.
 */
export function SearchList({ active }: { active: boolean }): React.JSX.Element {
  const selection = useFilesStore((state) => state.selection)
  const openDir = useFilesStore((state) => state.openDir)
  const openFile = useFilesStore((state) => state.openFile)

  return (
    <SearchPanel
      active={active}
      onOpenDir={openDir}
      onOpenFile={openFile}
      selectedPath={selection}
    />
  )
}
