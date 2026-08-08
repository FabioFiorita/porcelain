import { BoardCompanion } from '@/features/board/board-companion'
import { BoardList } from '@/features/board/board-list'
import { BoardPhoneScreen } from '@/features/board/board-phone-screen'
import { BoardViewer } from '@/features/board/board-viewer'
import { ChangesCompanion } from '@/features/changes/changes-companion'
import { ChangesList } from '@/features/changes/changes-list'
import { ChangesPhoneScreen } from '@/features/changes/changes-phone-screen'
import { ChangesViewer } from '@/features/changes/changes-viewer'
import { FilesCompanion } from '@/features/files/files-companion'
import { FilesList } from '@/features/files/files-list'
import { FilesPhoneScreen } from '@/features/files/files-phone-screen'
import { FilesViewer } from '@/features/files/files-viewer'
import { SearchCompanion } from '@/features/files/search-companion'
import { SearchList } from '@/features/files/search-list'
import { SearchPhoneScreen } from '@/features/files/search-phone-screen'
import { HistoryCompanion } from '@/features/history/history-companion'
import { HistoryList } from '@/features/history/history-list'
import { HistoryPhoneScreen } from '@/features/history/history-phone-screen'
import { HistoryViewer } from '@/features/history/history-viewer'
import { ReviewCompanion } from '@/features/review/review-companion'
import { ReviewList } from '@/features/review/review-list'
import { ReviewPhoneScreen } from '@/features/review/review-phone-screen'
import { ReviewViewer } from '@/features/review/review-viewer'
import { TerminalCompanion } from '@/features/terminal/terminal-companion'
import { TerminalList } from '@/features/terminal/terminal-list'
import { TerminalPhoneScreen } from '@/features/terminal/terminal-phone-screen'
import { TerminalViewer } from '@/features/terminal/terminal-viewer'

import type { SurfaceId } from './surfaces'

/**
 * A surface's real, daemon-backed panels. Every surface has a full set — the shell has no other
 * way to paint a column, and no mock fallback behind it any more.
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

const SURFACE_SLOTS: Record<SurfaceId, SurfaceSlots> = {
  // Board is the Review tab's other face on phone and its own rail destination on tablet, so
  // it owns all four panels: the columns read the same cards whichever way you arrive.
  board: {
    companion: BoardCompanion,
    list: BoardList,
    phone: BoardPhoneScreen,
    viewer: BoardViewer,
  },
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
  // way into the same tree, so it shares Files' viewer rather than owning a second copy. Its
  // companion is its own, because "what did I just look for" is not "where do I work" — the
  // same split the web rail makes.
  search: {
    companion: SearchCompanion,
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
  // The Review's three canvas tabs live inside its own body, not in the shell, so the list is
  // an outline that jumps the canvas rather than a route switcher — Intent, Execution and
  // Evidence are one unit of work seen three ways, never three destinations.
  review: {
    companion: ReviewCompanion,
    list: ReviewList,
    phone: ReviewPhoneScreen,
    viewer: ReviewViewer,
  },
  terminal: {
    companion: TerminalCompanion,
    list: TerminalList,
    phone: TerminalPhoneScreen,
    viewer: TerminalViewer,
  },
}

/**
 * Total by type, not by convention: a new `SurfaceId` without panels is a compile error, which
 * is what replaced the mock fallbacks the shell used to render for a surface that had none.
 */
export function surfaceSlots(surface: SurfaceId): SurfaceSlots {
  return SURFACE_SLOTS[surface]
}
