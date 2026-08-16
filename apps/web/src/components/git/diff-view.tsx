import { Button } from '@renderer/components/ui/button'
import { ContextMenu, ContextMenuTrigger } from '@renderer/components/ui/context-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useDiffFile } from '@renderer/features/git'
import { useIsMobile } from '@renderer/hooks/use-mobile'
import { fileName } from '@renderer/lib/paths'
import { useHubRepoPath } from '@renderer/stores/hub-repo'
import { activeTabTarget, targetedTab } from '@renderer/stores/hub-tabs'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useTabsStore } from '@renderer/stores/tabs'
import { FileText } from 'lucide-react'
import { DiffModeToggle } from './diff-mode-toggle'
import { HunksView } from './hunks-view'

export function DiffView({
  filePath,
  base,
}: {
  filePath: string
  base?: string
}): React.JSX.Element {
  const prefDiffMode = usePreferencesStore((s) => s.diffMode)
  // Split needs two code columns — force unified on phone for a readable glance.
  const isMobile = useIsMobile()
  const diffMode = isMobile ? 'unified' : prefDiffMode
  const repoPath = useHubRepoPath()
  const openTab = useTabsStore((s) => s.openTab)
  const { hunks, status, image, binary, error } = useDiffFile(filePath, base)

  // Jump from the diff to the whole file (a preview tab, like the Changes list's
  // "Open file"). Hidden for a deleted file — it no longer exists on disk, so
  // there's nothing to open.
  const handleOpenFile = (): void => {
    if (repoPath === null) return
    const absolute = `${repoPath}/${filePath}`
    openTab(
      targetedTab(
        'file',
        absolute,
        { title: fileName(filePath), preview: true },
        activeTabTarget(),
      ),
    )
  }

  if (error) return <p className="p-4 text-sm text-destructive">{error.message}</p>
  if (hunks === undefined && image === undefined && !binary) {
    return <p className="p-4 text-sm text-muted-foreground">Loading…</p>
  }

  // Image / binary diffs: no text hunks. Show a preview (images) or a quiet
  // placeholder instead of the old UTF-8 dump of PNG bytes.
  const nonText = image !== undefined || binary

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-1">
        <span className="truncate font-mono text-xs text-muted-foreground">{filePath}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          {status !== 'deleted' && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground"
                    onClick={handleOpenFile}
                    aria-label="Open file"
                  >
                    <FileText />
                  </Button>
                }
              />
              <TooltipContent>Open file</TooltipContent>
            </Tooltip>
          )}
          {!nonText && <DiffModeToggle />}
        </div>
      </div>
      {image !== undefined ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-auto p-8">
          <img
            src={image.dataUrl}
            alt={filePath}
            className="max-h-full max-w-full object-contain"
          />
          <p className="text-2xs text-muted-foreground">
            {status === 'untracked' || status === 'added' ? 'New image' : 'Image changed'} · binary
            diff
          </p>
        </div>
      ) : binary ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Binary file
        </div>
      ) : (
        <ContextMenu>
          {/* select-text so the diff stays selectable (the ui trigger defaults to
              select-none) — selecting lines is how you anchor a comment. */}
          <ContextMenuTrigger className="block min-h-0 flex-1 select-text">
            <HunksView hunks={hunks ?? []} filePath={filePath} diffMode={diffMode} />
          </ContextMenuTrigger>
        </ContextMenu>
      )}
    </div>
  )
}
