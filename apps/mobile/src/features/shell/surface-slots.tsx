import { ChangesCompanion } from '@/features/changes/changes-companion'
import { ChangesList } from '@/features/changes/changes-list'
import { ChangesPhoneScreen } from '@/features/changes/changes-phone-screen'
import { ChangesViewer } from '@/features/changes/changes-viewer'
import {
  FilesCompanion,
  FilesList,
  FilesPhoneScreen,
  FilesViewer,
  useFilesStore,
} from '@/features/files'
import { HistoryCompanion } from '@/features/history/history-companion'
import { HistoryList } from '@/features/history/history-list'
import { HistoryPhoneScreen } from '@/features/history/history-phone-screen'
import { HistoryViewer } from '@/features/history/history-viewer'
import { SearchCompanion, SearchList, SearchPhoneScreen } from '@/features/search'

import type { SurfaceId } from './surfaces'

function SearchListSlot({ active }: { active: boolean }): React.JSX.Element {
  const selection = useFilesStore((state) => state.selection)
  const openDir = useFilesStore((state) => state.openDir)
  const openFile = useFilesStore((state) => state.openFile)
  return (
    <SearchList
      active={active}
      onOpenDir={openDir}
      onOpenFile={openFile}
      selectedPath={selection}
    />
  )
}

/**
 * A surface's real, daemon-backed panels. Every surface has a full set — the shell has no other
 * way to paint a column, and no mock fallback behind it any more.
 *
 * Slots are only mounted for the ACTIVE surface, so a mounted panel is a focused panel — the
 * `active` flag they receive is about screen focus on phone (a native tab keeps its previous
 * screen mounted in the background), not about which surface is selected.
 *
 * Adding a tab is one entry here plus its feature folder. Keep the shape: list · viewer ·
 * companion for tablet, and `phone` for the surface's screen body. The screen's title and
 * toolbar are not in here — they are options on the Hub stack, drawn by the native header.
 * A surface with detail views gives them routes under `app/<surface>/` and pushes.
 */
export type SurfaceSlots = {
  /** Tablet supplementary column. */
  list: (props: { active: boolean }) => React.JSX.Element
  /** Tablet viewer column. */
  viewer: (props: { active: boolean }) => React.JSX.Element
  /** Tablet inspector column and the phone companion sheet. */
  companion: (props: { active: boolean }) => React.JSX.Element
  /** The phone screen body, under the native header the stack declares for it. */
  phone: () => React.JSX.Element
}

const SURFACE_SLOTS: Record<SurfaceId, SurfaceSlots> = {
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
    list: SearchListSlot,
    phone: SearchPhoneScreen,
    viewer: FilesViewer,
  },
  history: {
    companion: HistoryCompanion,
    list: HistoryList,
    phone: HistoryPhoneScreen,
    viewer: HistoryViewer,
  },
}

/**
 * Total by type, not by convention: a new `SurfaceId` without panels is a compile error, which
 * is what replaced the mock fallbacks the shell used to render for a surface that had none.
 */
export function surfaceSlots(surface: SurfaceId): SurfaceSlots {
  return SURFACE_SLOTS[surface]
}
