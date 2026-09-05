import { sameHubTarget } from '@porcelain/client-runtime/projects'
import { Button } from '@renderer/components/ui/button'
import {
  normalizeProjectRoot,
  projectRelativeFromAbsolute,
  useFilesScope,
} from '@renderer/features/files'
import { useHubRepoTarget } from '@renderer/stores/hub-repo'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useRevealStore } from '@renderer/stores/reveal'
import { useActiveTab } from '@renderer/stores/tabs'
import { LocateFixed } from 'lucide-react'

export function RevealActiveFile({ rootPath }: { rootPath: string }): React.JSX.Element {
  const tab = useActiveTab()
  const target = useHubRepoTarget()
  const scope = useFilesScope()
  const reveal = useRevealStore((s) => s.reveal)
  const path =
    tab?.kind === 'file' &&
    (tab.target === undefined || sameHubTarget(tab.target, target)) &&
    projectRelativeFromAbsolute(rootPath, tab.path) !== null
      ? tab.path
      : null

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      disabled={path === null}
      aria-label="Reveal active file"
      title="Reveal active file"
      data-testid="files-reveal-active"
      onClick={() => {
        if (path === null) return
        if (
          scope?.hiddenPaths.some((hidden) => {
            const normalized = normalizeProjectRoot(hidden)
            const candidate = normalizeProjectRoot(path)
            return candidate === normalized || candidate.startsWith(`${normalized}/`)
          })
        )
          useProjectSelectionStore.setState({ showHidden: true })
        reveal(path)
      }}
    >
      <LocateFixed />
    </Button>
  )
}
