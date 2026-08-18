/**
 * Where the shell's chrome sits relative to the window's true top-left corner.
 *
 * Both facts below are platform-conditional and needed by more than one surface, so they
 * lived as copy-pasted Tailwind literals until one copy drifted out of step with a fix
 * applied to the others. `sidebarTopOffsetClass` takes the platform flag as an argument
 * rather than reading `lib/platform` itself so a test can exercise both branches without
 * mocking the module — call sites pass `isFramelessShell` in.
 */

/**
 * Vertical placement for a floating sidebar. Only a frameless window (Linux/Windows) draws
 * its own h-12 (3rem) titlebar row above the sidebars — macOS's traffic lights are native
 * and overlay rather than displace, and the browser client has no window chrome at all —
 * so everyone else starts at the true window top.
 *
 * The `env(safe-area-inset-*)` terms are what keep the browser client clear of an iPhone
 * notch / home bar; they resolve to 0 on desktop Electron.
 */
export function sidebarTopOffsetClass(framelessShell: boolean): string {
  return framelessShell
    ? 'md:top-[calc(3rem+env(safe-area-inset-top))] md:h-[calc(100dvh-3rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]'
    : 'md:top-[env(safe-area-inset-top)] md:h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))]'
}

/**
 * Left padding that clears macOS's native traffic lights, for whichever chrome currently
 * owns the window's top-left corner. macOS paints them at a fixed position no matter what
 * the renderer draws underneath (`trafficLightPosition: { x: 19 }` in
 * `apps/desktop/src/main/window.ts`, spanning to roughly x:70), so that chrome has to step
 * out of the way; 80px clears them with room to spare.
 *
 * Shared rather than inlined because two surfaces take turns owning that corner — the left
 * sidebar header while it is open, the Viewer header once it collapses. A clearance applied
 * to only one of them leaves the other's first control (the sidebar toggle) sitting
 * underneath the close button. Each surface keeps its OWN non-macOS gutter, which is why
 * this is the clearance alone and not a ternary.
 */
export const MAC_TRAFFIC_LIGHT_CLEARANCE = 'pl-20'
