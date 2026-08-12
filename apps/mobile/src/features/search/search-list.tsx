import { SearchPanel } from './search-panel'

/**
 * The tablet's supplementary column for the Search destination.
 *
 * Files owns the navigation state; the shell slot supplies those callbacks so Search can remain
 * a presentation feature without importing the Files implementation seam.
 */
export function SearchList({
  active,
  onOpenDir,
  onOpenFile,
  selectedPath,
}: {
  active: boolean
  onOpenDir: (path: string) => void
  onOpenFile: (path: string, line?: number) => void
  selectedPath: string | null
}): React.JSX.Element {
  return (
    <SearchPanel
      active={active}
      onOpenDir={onOpenDir}
      onOpenFile={onOpenFile}
      selectedPath={selectedPath}
    />
  )
}
