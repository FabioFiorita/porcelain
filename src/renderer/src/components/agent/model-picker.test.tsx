import {
  useAgentModelFavorites,
  useAgentProviders,
  useToggleAgentModelFavorite,
  useUpdateAgentThread,
} from '@renderer/hooks/use-agents'
import type { ProviderStatus } from '@shared/agent-protocol'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ModelPicker } from './model-picker'

// Repo idiom: mock the domain hooks, never tRPC.
vi.mock('@renderer/hooks/use-agents', () => ({
  useAgentProviders: vi.fn(),
  useAgentModelFavorites: vi.fn(),
  useToggleAgentModelFavorite: vi.fn(),
  useUpdateAgentThread: vi.fn(),
}))

// Base UI's popover/scroll-area polls getAnimations on a timer; jsdom has none.
Element.prototype.getAnimations ??= (): Animation[] => []

// A claude provider whose catalog has NO entry with id '' — so the empty model
// selected by "New thread with…" never resolves to a catalog label.
const claude: ProviderStatus = {
  provider: 'claude',
  installed: true,
  authenticated: true,
  models: [{ id: 'opus', label: 'Opus', provider: 'claude' }],
}

describe('ModelPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAgentProviders).mockReturnValue([claude])
    vi.mocked(useAgentModelFavorites).mockReturnValue([])
    vi.mocked(useToggleAgentModelFavorite).mockReturnValue({ toggle: vi.fn() })
    vi.mocked(useUpdateAgentThread).mockReturnValue({ update: vi.fn() })
  })

  it('labels an empty model "Default model" (the CLI picks its own default)', () => {
    render(<ModelPicker threadId="t1" provider="claude" model="" />)
    expect(screen.getByRole('button', { name: 'Default model' })).toBeInTheDocument()
  })

  it('labels an empty model with the CLI-resolved model (prefix-matched) plus a default tag', () => {
    render(<ModelPicker threadId="t1" provider="claude" model="" resolvedModel="opus-20260115" />)
    expect(screen.getByRole('button', { name: 'Opus · default' })).toBeInTheDocument()
  })

  it('shows a not-in-catalog model id verbatim', () => {
    render(<ModelPicker threadId="t1" provider="claude" model="opus-x" />)
    expect(screen.getByRole('button', { name: 'opus-x' })).toBeInTheDocument()
  })
})
