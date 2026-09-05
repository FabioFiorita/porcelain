import { ctrlIsPrimary } from '@renderer/lib/keyboard'
import { formatForDisplay, type Hotkey, normalizeRegisterableHotkey } from '@tanstack/react-hotkeys'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const fileCommands = {
  'files.create-file': 'Create file',
  'files.create-folder': 'Create folder',
  'files.duplicate': 'Duplicate',
  'files.trash': 'Move to trash',
} as const
export type FileCommandId = keyof typeof fileCommands
export const defaultFileBindings: Record<FileCommandId, Hotkey> = {
  'files.create-file': 'Mod+N',
  'files.create-folder': 'Mod+Shift+N',
  'files.duplicate': 'Mod+D',
  'files.trash': 'Mod+Backspace',
}
export const shortcutPlatform = ctrlIsPrimary ? 'windows' : 'mac'
export const commandShortcutLabel = (binding: Hotkey): string =>
  formatForDisplay(binding, { platform: shortcutPlatform })

export const useFileBindings = create(
  persist<{
    overrides: Partial<Record<FileCommandId, Hotkey | null>>
    setBinding: (id: FileCommandId, binding: Hotkey | null) => void
    reset: () => void
  }>(
    (set) => ({
      overrides: {},
      setBinding: (id, binding) => set((s) => ({ overrides: { ...s.overrides, [id]: binding } })),
      reset: () => set({ overrides: {} }),
    }),
    { name: 'porcelain-file-shortcuts' },
  ),
)

export function fileBinding(
  id: FileCommandId,
  overrides: Partial<Record<FileCommandId, Hotkey | null>>,
): Hotkey | null {
  return overrides[id] === undefined ? defaultFileBindings[id] : overrides[id]
}

export function bindingConflict(
  id: FileCommandId,
  binding: Hotkey,
  overrides: Partial<Record<FileCommandId, Hotkey | null>>,
): string | null {
  const normalized = normalizeRegisterableHotkey(binding, shortcutPlatform)
  for (const other of Object.keys(fileCommands) as FileCommandId[]) {
    const candidate = fileBinding(other, overrides)
    if (
      other !== id &&
      candidate &&
      normalizeRegisterableHotkey(candidate, shortcutPlatform) === normalized
    )
      return fileCommands[other]
  }
  // Other app commands still own these bindings during the incremental migration.
  const reserved: Hotkey[] = [
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
    'Enter',
    'Escape',
    'Tab',
    'F2',
    'Mod+K',
    'Mod+P',
    'Mod+Shift+F',
    'Mod+W',
    'Mod+J',
    'Mod+T',
    'Mod+B',
    'Mod+Shift+A',
    'Mod+Shift+S',
    'Mod+1',
    'Mod+2',
    'Mod+3',
    'Mod+4',
    'Mod+5',
    'Control+Tab',
    'Control+Shift+Tab',
    'Mod+S',
    'Mod+F',
  ]
  return reserved.some((key) => normalizeRegisterableHotkey(key, shortcutPlatform) === normalized)
    ? 'another app command'
    : null
}
