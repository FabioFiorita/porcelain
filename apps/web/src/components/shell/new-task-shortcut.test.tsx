import { useFilePromptStore } from '@renderer/stores/file-prompt'
import { useNewTaskDialogStore } from '@renderer/stores/new-task-dialog'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useSurfaceSessionStore } from '@renderer/stores/surface-session'
import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FileCommands } from './file-commands'
import { useAppShortcuts } from './use-app-shortcuts'

vi.mock('@renderer/features/files', () => ({
  useFilesActions: () => ({
    duplicate: async () => undefined,
    trash: async () => false,
    createFile: async () => undefined,
    createFolder: async () => undefined,
    rename: async () => undefined,
  }),
}))

function ShortcutHost(): React.JSX.Element {
  useAppShortcuts()
  return <FileCommands />
}

function pressNewChord(): void {
  fireEvent.keyDown(window, { key: 'n', ctrlKey: true, shiftKey: true })
}

describe('⌘⇧N vs Files focus', () => {
  beforeEach(() => {
    usePreferencesStore.setState({ sidebarTab: 'files' })
    useSurfaceSessionStore.setState({ openTabs: [] })
    useNewTaskDialogStore.getState().hide()
    useFilePromptStore.getState().close()
  })

  it('opens New Task on the launcher even though the persisted tab is files', () => {
    render(<ShortcutHost />)
    pressNewChord()
    expect(useNewTaskDialogStore.getState().open).toBe(true)
    expect(useFilePromptStore.getState().kind).toBeNull()
  })

  it('opens a new folder when the Files surface is actually showing', () => {
    useSurfaceSessionStore.getState().setOpenTabs(['files'])
    render(<ShortcutHost />)
    pressNewChord()
    expect(useFilePromptStore.getState().kind).toBe('new-folder')
    expect(useNewTaskDialogStore.getState().open).toBe(false)
  })
})
