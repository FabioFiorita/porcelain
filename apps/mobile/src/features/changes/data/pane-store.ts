import { create } from 'zustand'

import type { FilePickerFile } from '@/features/changes/components/file-picker-pane'

type ChangesPane = {
  readonly files: readonly FilePickerFile[]
  readonly onSelect: (path: string) => void
  readonly owner: symbol
  readonly selectedPath: string | null
}

type ChangesPaneState = {
  readonly pane: ChangesPane | null
  readonly clear: (owner: symbol) => void
  readonly publish: (pane: ChangesPane) => void
}

export const useChangesPaneStore = create<ChangesPaneState>((set) => ({
  clear: (owner: symbol): void =>
    set((state) => (state.pane?.owner === owner ? { pane: null } : state)),
  pane: null,
  publish: (pane: ChangesPane): void => set({ pane }),
}))
