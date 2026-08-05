import { ChangesCompanion } from '@/features/changes/changes-companion'
import { ChangesList } from '@/features/changes/changes-list'
import { ChangesPhoneScreen } from '@/features/changes/changes-phone-screen'
import { ChangesViewer } from '@/features/changes/changes-viewer'
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
