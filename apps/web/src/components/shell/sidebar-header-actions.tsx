import { createContext, useContext } from 'react'
import { createPortal } from 'react-dom'

// The contextual surface toolbar owns one actions region below the surface tabs;
// each tab body portals its icon-buttons into it while keeping its hooks/state local.
const SidebarHeaderActionsContext = createContext<HTMLElement | null>(null)

export const SidebarHeaderActionsProvider: React.Provider<HTMLElement | null> =
  SidebarHeaderActionsContext.Provider

/** Renders its children into the panel header's actions region (or nowhere yet). */
export function SidebarHeaderActions({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element | null {
  const slot = useContext(SidebarHeaderActionsContext)
  return slot ? createPortal(children, slot) : null
}
