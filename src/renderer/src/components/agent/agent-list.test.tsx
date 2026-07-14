import { SidebarHeaderActionsProvider } from '@renderer/components/shell/sidebar-header-actions'
import {
  useAgentProviders,
  useAgentThreads,
  useCreateAgentThread,
  useDeleteAgentThread,
  useExternalAgentSessions,
  useImportAgentSession,
  useRenameAgentThread,
} from '@renderer/hooks/use-agents'
import { useTabsStore } from '@renderer/stores/tabs'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentList } from './agent-list'

// Repo idiom: mock the domain hooks, never tRPC. The tabs store is real (a row's
// active-tab resolution reads it); the header actions portal into a real slot node.
vi.mock('@renderer/hooks/use-agents', () => ({
  useAgentThreads: vi.fn(),
  useAgentProviders: vi.fn(),
  useCreateAgentThread: vi.fn(),
  useDeleteAgentThread: vi.fn(),
  useRenameAgentThread: vi.fn(),
  useExternalAgentSessions: vi.fn(),
  useImportAgentSession: vi.fn(),
}))

// Base UI's menu positioner/scroll-area polls getAnimations on a timer; jsdom has none.
Element.prototype.getAnimations ??= (): Animation[] => []

// The header actions (incl. the split-button dropdown) portal into a context slot —
// without a provider they render nowhere, so seed a real, attached node.
function renderList(): void {
  const slot = document.createElement('div')
  document.body.appendChild(slot)
  render(
    <SidebarHeaderActionsProvider value={slot}>
      <AgentList />
    </SidebarHeaderActionsProvider>,
  )
}

describe('AgentList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useTabsStore.setState({ panes: [{ tabs: [], activeTabId: null }], activePaneIndex: 0 })
    vi.mocked(useAgentThreads).mockReturnValue([])
    vi.mocked(useAgentProviders).mockReturnValue([])
    vi.mocked(useCreateAgentThread).mockReturnValue({ create: vi.fn(), isPending: false })
    vi.mocked(useDeleteAgentThread).mockReturnValue({ remove: vi.fn(), isPending: false })
    vi.mocked(useRenameAgentThread).mockReturnValue({ rename: vi.fn() })
    vi.mocked(useExternalAgentSessions).mockReturnValue([])
    vi.mocked(useImportAgentSession).mockReturnValue({
      importSession: vi.fn(),
      isPending: false,
    })
  })

  it('opens the provider menu without throwing (GroupLabel needs a Group)', async () => {
    renderList()
    fireEvent.click(screen.getByRole('button', { name: 'Choose provider for new thread' }))
    expect(await screen.findByText('New thread with…')).toBeInTheDocument()
  })
})
