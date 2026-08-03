import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { NotesCard } from './notes-card'
import { PinnedGroup } from './pinned-group'
import { NotesResizeHandle } from './sidebar-resize-handle'

// Files-tab Quick Access: pinned items up top (scroll), a draggable divider,
// then the per-repo notes card pinned to `--notes-height` at the bottom.
export function FilesQuickAccess(): React.JSX.Element {
  const notesHeight = usePreferencesStore((s) => s.notesHeight)
  const repoPath = useRepoStore((s) => s.repo?.path)

  return (
    <div
      data-slot="files-quick-access"
      className="flex h-full min-h-0 flex-col"
      style={{ '--notes-height': `${notesHeight}px` } as React.CSSProperties}
    >
      <div className="min-h-0 flex-1 overflow-auto">
        <PinnedGroup />
      </div>
      <NotesResizeHandle />
      <div className="h-(--notes-height) shrink-0">
        {/* remount per repo so the editor reloads that repo's notes */}
        <NotesCard key={repoPath ?? 'none'} repoPath={repoPath} />
      </div>
    </div>
  )
}
