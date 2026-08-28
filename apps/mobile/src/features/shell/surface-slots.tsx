import { CanvasSurfacePanel } from '@/features/canvas/canvas-surface-panel'
import { ChangesPhoneScreen } from '@/features/changes/changes-phone-screen'
import { ChangesSurfacePanel } from '@/features/changes/changes-surface-panel'
import { FilesPhoneScreen, FilesSurfacePanel } from '@/features/files'
import { GitSurfacePanel } from '@/features/git/git-surface-panel'
import { HistoryPhoneScreen } from '@/features/history/history-phone-screen'
import { HistorySurfacePanel } from '@/features/history/history-surface-panel'
import { SearchPhoneScreen, SearchSurfacePanel } from '@/features/search'

import type { SurfaceId } from './surfaces'

/**
 * A surface's real, daemon-backed bodies. Every surface has a full set — the shell has no other
 * way to paint a column, and no mock fallback behind it any more.
 *
 * Two hosts, and they are not the same shape:
 *
 *   - **`panel`** is a tab of the tablet's trailing Surfaces panel, beside the viewer. It is
 *     handed `active` because it is not a routed screen and has no `useIsFocused` to ask — the
 *     panel knows which of its tabs is showing, and only that one polls the daemon.
 *   - **`phone`** is the surface's screen inside the Hub stack, under the header `SurfaceScreen`
 *     draws. It asks the navigator whether it is focused itself.
 *
 * Adding a surface is one entry here plus its feature folder, and the record is total by type:
 * a new `SurfaceId` without bodies is a compile error.
 */
export type SurfaceSlots = {
  /** Tablet Surfaces-panel tab body. */
  panel: (props: { active: boolean }) => React.JSX.Element
  /** The phone screen body, under the header `SurfaceScreen` draws. */
  phone: (props: { active: boolean }) => React.JSX.Element
}

const SURFACE_SLOTS: Record<SurfaceId, SurfaceSlots> = {
  // Canvas has no companion: the surface is a list of documents and the answer to one is a
  // review comment, which is a destination on the surface rather than a card beside it.
  canvas: {
    panel: CanvasSurfacePanel,
    phone: CanvasSurfacePanel,
  },
  // Changes has no companion, here and on web: everything one would hold — suggestions, git
  // commands, the commit composer — belongs to the Git surface, and a sheet that opens to say so
  // is worse than a bolt that is not there.
  changes: {
    panel: ChangesSurfacePanel,
    phone: ChangesPhoneScreen,
  },
  files: {
    panel: FilesSurfacePanel,
    phone: FilesPhoneScreen,
  },
  // Git's surface IS what a companion column would hold. A bolt would open a sheet showing what
  // is already on the screen that opened it.
  git: {
    panel: GitSurfacePanel,
    phone: GitSurfacePanel,
  },
  history: {
    panel: HistorySurfacePanel,
    phone: HistoryPhoneScreen,
  },
  // Search is a different way into the same tree Files owns, so it shares Files' navigation
  // rather than owning a second copy. Its companion is its own, because "what did I just look
  // for" is not "where do I work" — the same split the web rail makes.
  search: {
    panel: SearchSurfacePanel,
    phone: SearchPhoneScreen,
  },
}

export function surfaceSlots(surface: SurfaceId): SurfaceSlots {
  return SURFACE_SLOTS[surface]
}
