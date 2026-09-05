import {
  type FileCommandId,
  fileBinding,
  fileCommands,
  shortcutPlatform,
  useFileBindings,
} from '@renderer/features/commands/file-command-bindings'
import { useFilesActions } from '@renderer/features/files'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { isTerminalTarget } from '@renderer/lib/keyboard'
import { dirName } from '@renderer/lib/paths'
import { isFilesSurfaceFocused } from '@renderer/lib/surface-focus'
import { useFilePromptStore } from '@renderer/stores/file-prompt'
import { targetedTab } from '@renderer/stores/hub-tabs'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useSelectionStore } from '@renderer/stores/selection'
import { useTabsStore } from '@renderer/stores/tabs'
import { runUserAction } from '@shared/background'
import { useHotkeys } from '@tanstack/react-hotkeys'

export function FileCommands(): null {
  const { duplicate, trash } = useFilesActions()
  const overrides = useFileBindings((s) => s.overrides)
  const execute = (id: FileCommandId): void => {
    const prompt = useFilePromptStore.getState()
    const { selected, active } = useSelectionStore.getState()
    const project = useProjectSelectionStore.getState().project
    if (!project) return
    const newDir = active
      ? active.kind === 'dir'
        ? active.path
        : dirName(active.path)
      : project.path
    const targets = selected.size > 0 ? [...selected] : active ? [active.path] : []
    if (id === 'files.create-file') prompt.newFile(newDir)
    else if (id === 'files.create-folder') prompt.newFolder(newDir)
    else
      runUserAction(
        async () => {
          for (const path of targets) {
            if (id === 'files.duplicate') await duplicate(path)
            else if (await trash(path))
              useTabsStore
                .getState()
                .closeTabEverywhere(targetedTab('file', path, { title: '' }).id)
          }
          if (id === 'files.trash') useSelectionStore.getState().clear()
        },
        (error) => toastUserActionError(fileCommands[id], error),
      )
  }
  useHotkeys(
    (Object.keys(fileCommands) as FileCommandId[]).flatMap((id) => {
      const hotkey = fileBinding(id, overrides)
      return hotkey === null
        ? []
        : [
            {
              hotkey,
              callback: (event: KeyboardEvent) => {
                if (
                  !isFilesSurfaceFocused() ||
                  isTerminalTarget(event.target) ||
                  (event.target instanceof HTMLElement &&
                    event.target.closest('[role="dialog"], [role="alertdialog"], [role="menu"]'))
                )
                  return
                event.preventDefault()
                event.stopPropagation()
                execute(id)
              },
            },
          ]
    }),
    {
      platform: shortcutPlatform,
      ignoreInputs: true,
      preventDefault: false,
      stopPropagation: false,
      conflictBehavior: 'error',
    },
  )
  return null
}
