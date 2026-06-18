import { createContext, useContext } from 'react'
import { createPortal } from 'react-dom'

// The contextual panel header (in app-sidebar) owns one actions region; each tab
// body portals its header icon-buttons into it instead of rendering a second
// toolbar row below the title. This keeps every tab's actions in the header
// (matching the Files tab) while letting each list keep its own hooks/state.
const SidebarHeaderActionsContext = createContext<HTMLElement | null>(null)

export const SidebarHeaderActionsProvider = SidebarHeaderActionsContext.Provider

/** Renders its children into the panel header's actions region (or nowhere yet). */
export function SidebarHeaderActions({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element | null {
  const slot = useContext(SidebarHeaderActionsContext)
  return slot ? createPortal(children, slot) : null
}
