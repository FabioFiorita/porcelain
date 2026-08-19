import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider } from './sidebar'

function renderMenu(): void {
  render(
    <SidebarProvider>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton isActive>Companion</SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton>Remotes</SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarProvider>
  )
}

describe('SidebarMenuButton selected vs hover', () => {
  it('marks only the active item with data-active', () => {
    renderMenu()
    expect(screen.getByText('Companion')).toHaveAttribute('data-active')
    expect(screen.getByText('Remotes')).not.toHaveAttribute('data-active')
  })

  it('gates the hover fill so it never stacks on the selected item', () => {
    renderMenu()
    // The selected fill is the full accent; hover is a subordinate 50% accent that
    // `not-data-active` switches off on the selected row, so the two never merge.
    for (const label of ['Companion', 'Remotes']) {
      const classes = screen.getByText(label).className.split(' ')
      expect(classes).toContain('not-data-active:hover:bg-sidebar-accent/50')
      expect(classes).not.toContain('hover:bg-sidebar-accent')
      expect(classes).toContain('data-active:bg-sidebar-accent')
    }
  })
})
