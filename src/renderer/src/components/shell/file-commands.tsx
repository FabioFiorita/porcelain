import { useDuplicatePath, useTrashPath } from '@renderer/hooks/use-files'
import { isTextEntry } from '@renderer/lib/keyboard'
import { useFilePromptStore } from '@renderer/stores/file-prompt'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { useSelectionStore } from '@renderer/stores/selection'
import { useEffect } from 'react'

/**
 * Files-tab keyboard shortcuts: ⌘N new file, ⌘⇧N new folder, ⌘D duplicate, ⌘⌫ trash.
 * Lives in its own always-mounted component (next to FileFinder) rather than the global
 * shortcut hook because the fs mutations go through tRPC hooks, which only components may
 * touch. Active only while the Files tab is showing; targets the multi-selection, or the
 * last-clicked row when nothing is selected.
 */
export function FileCommands(): null {
  const duplicate = useDuplicatePath()
  const trash = useTrashPath()

  useEffect(() => {
    const onKeyDown = async (e: KeyboardEvent): Promise<void> => {
      if (usePreferencesStore.getState().sidebarTab !== 'files') return
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return
      if (isTextEntry(e.target)) return

      const prompt = useFilePromptStore.getState()
      const { selected, active } = useSelectionStore.getState()
      const repo = useRepoStore.getState().repo
      // Where a new file/folder lands: into the active folder, beside the active file,
      // else the repo root.
      const newDir = active
        ? active.kind === 'dir'
          ? active.path
          : active.path.slice(0, active.path.lastIndexOf('/'))
        : (repo?.path ?? '')
      // What duplicate/trash act on: the multi-selection, else the active row.
      const targets = selected.size > 0 ? [...selected] : active ? [active.path] : []

      const key = e.key.toLowerCase()
      if (key === 'n' && e.shiftKey) {
        e.preventDefault()
        prompt.newFolder(newDir)
      } else if (key === 'n' && !e.shiftKey) {
        e.preventDefault()
        prompt.newFile(newDir)
      } else if (key === 'd' && !e.shiftKey) {
        if (targets.length === 0) return
        e.preventDefault()
        for (const path of targets) await duplicate(path)
      } else if (e.key === 'Backspace') {
        if (targets.length === 0) return
        e.preventDefault()
        for (const path of targets) await trash(path)
        useSelectionStore.getState().clear()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [duplicate, trash])

  return null
}
