import { ChangesCompanion } from '@/features/changes/changes-companion'
import { ChangesList } from '@/features/changes/changes-list'
import { ChangesPhoneScreen } from '@/features/changes/changes-phone-screen'
import { ChangesViewer } from '@/features/changes/changes-viewer'
import { FilesCompanion } from '@/features/files/files-companion'
import { FilesList } from '@/features/files/files-list'
import { FilesPhoneScreen } from '@/features/files/files-phone-screen'
import { FilesViewer } from '@/features/files/files-viewer'
import { SearchList } from '@/features/files/search-list'
import { SearchPhoneScreen } from '@/features/files/search-phone-screen'
import { HistoryCompanion } from '@/features/history/history-companion'
import { HistoryList } from '@/features/history/history-list'
import { HistoryPhoneScreen } from '@/features/history/history-phone-screen'
import { HistoryViewer } from '@/features/history/history-viewer'
import { TerminalCompanion } from '@/features/terminal/terminal-companion'
import { TerminalList } from '@/features/terminal/terminal-list'
import { TerminalPhoneScreen } from '@/features/terminal/terminal-phone-screen'
import { TerminalViewer } from '@/features/terminal/terminal-viewer'

import type { SurfaceId } from './mock-data'

/**
 * A surface's real, daemon-backed panels. The shell renders these when a surface has them and
 * falls back to the mock content otherwise, so tabs can land one at a time without a
 * big-bang cutover.
 *
 * Slots are only mounted for the ACTIVE surface, so a mounted panel is a focused panel — the
 * `active` flag they receive is about screen focus on phone (a native tab keeps its previous
 * screen mounted in the background), not about which surface is selected.
 *
 * Adding a tab is one entry here plus its feature folder. Keep the shape: list · viewer ·
 * companion for tablet, and `phone` for the tab's root screen, which owns its own header.
 * A surface with detail views gives them routes under `app/<surface>/` and pushes.
 */
export type SurfaceSlots = {
  /** Tablet supplementary column. */
  list: (props: { active: boolean }) => React.JSX.Element
  /** Tablet viewer column. */
  viewer: (props: { active: boolean }) => React.JSX.Element
  /** Tablet inspector column and the phone companion sheet. */
  companion: (props: { active: boolean }) => React.JSX.Element
  /** Whole phone tab body, including its header. */
  phone: () => React.JSX.Element
}

const SURFACE_SLOTS: Partial<Record<SurfaceId, SurfaceSlots>> = {
  changes: {
    companion: ChangesCompanion,
    list: ChangesList,
    phone: ChangesPhoneScreen,
    viewer: ChangesViewer,
  },
  files: {
    companion: FilesCompanion,
    list: FilesList,
    phone: FilesPhoneScreen,
    viewer: FilesViewer,
  },
  // Search is the Files tab's other face and the tablet rail's own destination: a different
  // way into the same tree, so it shares Files' viewer and companion rather than owning a
  // second copy of either.
  search: {
    companion: FilesCompanion,
    list: SearchList,
    phone: SearchPhoneScreen,
    viewer: FilesViewer,
  },
  history: {
    companion: HistoryCompanion,
    list: HistoryList,
    phone: HistoryPhoneScreen,
    viewer: HistoryViewer,
  },
  terminal: {
    companion: TerminalCompanion,
    list: TerminalList,
    phone: TerminalPhoneScreen,
    viewer: TerminalViewer,
  },
}

export function surfaceSlots(surface: SurfaceId): SurfaceSlots | undefined {
  return SURFACE_SLOTS[surface]
}
