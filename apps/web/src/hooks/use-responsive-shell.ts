import { decideResponsiveLayout, type PanelState } from '@renderer/lib/responsive-shell'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useEffect, useRef } from 'react'

// The center viewer never shrinks below this (px) while both side panels are
// open. 24rem clears the h-12 chrome and leaves the floating tab capsule room
// for a few tabs before panels start giving way.
const VIEWER_MIN_WIDTH = 384 // 24rem
// The icon rail is `--sidebar-width-icon` (4rem = 64px); the collapsed floating
// gap adds spacing(4) = 16px (see the sidebar primitive's gap width).
const LEFT_RAIL_WIDTH = 80 // 64 + 16
// The ~8px gap on each side of the center tile (floating-tile padding / margin)
// sits outside the three column widths. Approximate — a few px of slop here only
// shifts the collapse threshold slightly.
const SHELL_CHROME = 16

interface Params {
  /** The left sidebar's open state, from the outer (left) SidebarProvider. */
  leftOpen: boolean
  /** Drives the left sidebar open/collapsed (the provider's `setOpen`). */
  setLeftOpen: (open: boolean) => void
  /** Tabs without a Quick Access section (e.g. Board) suppress the right panel. */
  rightSuppressed: boolean
}

/**
 * Keep the center viewer usable: when the window is too narrow to honor its
 * minimum width with both side panels open, close the right Quick Access first,
 * then collapse the left sidebar to its rail; restore them (only the ones the
 * system collapsed) as the window widens. The give-way / restore semantics live
 * in `decideResponsiveLayout`; this hook is the thin DOM layer — it observes the
 * window width, reconciles user toggles, and drives the two providers.
 */
export function useResponsiveShell({ leftOpen, setLeftOpen, rightSuppressed }: Params): void {
  const sidebarWidth = usePreferencesStore((s) => s.sidebarWidth)
  const rightSidebarWidth = usePreferencesStore((s) => s.rightSidebarWidth)
  const rightOpen = usePreferencesStore((s) => s.rightSidebarOpen)
  const setRightOpen = usePreferencesStore((s) => s.setRightSidebarOpen)

  // Transient reconciliation state (nothing else reads it, so refs, not state):
  // the system-collapsed flags, the previous window width (to tell widen from
  // narrow), and the open states the system last drove each panel to (to detect
  // a user toggle that happened in between).
  const autoCollapsedLeft = useRef(false)
  const autoClosedRight = useRef(false)
  const prevWidth = useRef<number | null>(null)
  const systemLeft = useRef<boolean | null>(null)
  const systemRight = useRef<boolean | null>(null)

  useEffect(() => {
    const evaluate = (): void => {
      const effectiveRightOpen = rightOpen && !rightSuppressed

      // Reconcile user intent: if a panel's state diverged from what the system
      // last drove it to, the user toggled it — clear that panel's auto flag so
      // a user-closed panel is never auto-reopened and a user-opened one isn't
      // slammed shut (it re-collapses only on a further width decrease).
      if (systemLeft.current !== null && leftOpen !== systemLeft.current) {
        autoCollapsedLeft.current = false
      }
      if (!rightSuppressed && systemRight.current !== null && rightOpen !== systemRight.current) {
        autoClosedRight.current = false
      }

      const current: PanelState = {
        leftOpen,
        rightOpen: effectiveRightOpen,
        autoCollapsedLeft: autoCollapsedLeft.current,
        // The right panel reserves 0 width while suppressed, so it doesn't
        // participate — freeze its flag and don't let it be restored here.
        autoClosedRight: rightSuppressed ? false : autoClosedRight.current,
      }

      const next = decideResponsiveLayout(
        {
          windowWidth: window.innerWidth,
          leftPanelWidth: sidebarWidth,
          leftRailWidth: LEFT_RAIL_WIDTH,
          rightPanelWidth: rightSidebarWidth,
          chrome: SHELL_CHROME,
          viewerMinWidth: VIEWER_MIN_WIDTH,
        },
        current,
        prevWidth.current,
      )

      prevWidth.current = window.innerWidth

      if (next.leftOpen !== leftOpen) setLeftOpen(next.leftOpen)
      autoCollapsedLeft.current = next.autoCollapsedLeft
      systemLeft.current = next.leftOpen

      // While suppressed, leave the right panel's preference and refs untouched
      // (toggling the hidden panel would silently flip the user's stored pref).
      if (!rightSuppressed) {
        if (next.rightOpen !== effectiveRightOpen) setRightOpen(next.rightOpen)
        autoClosedRight.current = next.autoClosedRight
        systemRight.current = next.rightOpen
      }
    }

    evaluate()
    window.addEventListener('resize', evaluate)
    return () => window.removeEventListener('resize', evaluate)
  }, [
    leftOpen,
    rightOpen,
    rightSuppressed,
    sidebarWidth,
    rightSidebarWidth,
    setLeftOpen,
    setRightOpen,
  ])
}
