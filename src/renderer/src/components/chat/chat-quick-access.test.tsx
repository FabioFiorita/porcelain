import { SidebarProvider } from '@renderer/components/ui/sidebar'
import { useChatClaims } from '@renderer/hooks/use-chat-claims'
import type { ChatClaims } from '@renderer/lib/chat-claims'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChatQuickAccess } from './chat-quick-access'

// Like the other shell-group tests: mock the domain hook, never tRPC.
vi.mock('@renderer/hooks/use-chat-claims', () => ({ useChatClaims: vi.fn() }))

function renderPanel(claims: ChatClaims): void {
  vi.mocked(useChatClaims).mockReturnValue(claims)
  render(
    <SidebarProvider>
      <ChatQuickAccess />
    </SidebarProvider>,
  )
}

describe('ChatQuickAccess', () => {
  it('shows empty states and hides Overlaps when there is nothing', () => {
    renderPanel({ liveClaims: [], overlaps: [], participants: [] })
    expect(screen.getByText(/No one has posted yet/)).toBeInTheDocument()
    expect(screen.getByText(/No active claims/)).toBeInTheDocument()
    expect(screen.queryByText(/Overlaps/)).not.toBeInTheDocument()
  })

  it('renders participants, a claim with its files, and an overlap warning', () => {
    renderPanel({
      participants: [
        { from: 'alice', lastAt: 1 },
        { from: 'bob', lastAt: 2 },
      ],
      liveClaims: [
        { from: 'alice', files: ['src/auth.ts', 'src/session.ts'], intent: 'wiring login', at: 1 },
        { from: 'bob', files: ['src/session.ts'], at: 2 },
      ],
      overlaps: [{ a: 'alice', b: 'bob', files: ['src/session.ts'] }],
    })
    expect(screen.getByText('Participants · 2')).toBeInTheDocument()
    expect(screen.getByText('Claims · 2')).toBeInTheDocument()
    expect(screen.getByText('wiring login')).toBeInTheDocument()
    // File chips render the basename (fileName), and Overlaps is visible with the pair.
    expect(screen.getAllByText('auth.ts').length).toBeGreaterThan(0)
    expect(screen.getByText('Overlaps · 1')).toBeInTheDocument()
  })
})
