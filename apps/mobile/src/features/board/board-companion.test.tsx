import { boardContractFixtures } from '@porcelain/contracts/board'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BoardCompanion } from './board-companion'
import { createBoardHarness, PAIRED_ENV, REPO, type TestDaemonClient } from './test-support'

const ctx = vi.hoisted(() => ({
  client: null as TestDaemonClient | null,
}))

vi.mock('@/lib/daemon/client', () => ({
  getDaemonClient: (): TestDaemonClient => {
    if (ctx.client === null) throw new Error('test client not installed')
    return ctx.client
  },
}))

vi.mock('@/features/projects', () => ({
  useActiveProject: () => ({ path: REPO, name: 'repo' }),
}))

vi.mock('@/lib/daemon/environments-store', () => ({
  useActiveEnvironment: () => PAIRED_ENV,
}))

vi.mock('@/features/shell/use-app-window', () => ({
  useIsTablet: () => true,
}))

vi.mock('@/features/shell/shell-store', () => ({
  useShellStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      openSheet: vi.fn(),
      setActiveSurface: vi.fn(),
      closeSheet: vi.fn(),
    }),
}))

vi.mock('@/features/shell/tab-faces', () => ({
  useTabFaces: (selector: (s: { setReview: () => void }) => unknown) =>
    selector({ setReview: vi.fn() }),
}))

vi.mock('react-native', () => {
  const React = require('react') as typeof import('react')
  const el =
    (tag: string) =>
    ({
      children,
      testID,
      accessibilityLabel,
      onPress,
    }: {
      children?: React.ReactNode
      testID?: string
      accessibilityLabel?: string
      onPress?: () => void
    }) =>
      React.createElement(
        tag === 'Pressable' ? 'button' : tag === 'Text' ? 'span' : 'div',
        {
          'data-testid': testID,
          'aria-label': accessibilityLabel,
          onClick: onPress,
          type: tag === 'Pressable' ? 'button' : undefined,
        },
        children,
      )
  return {
    View: el('View'),
    Text: el('Text'),
    Pressable: el('Pressable'),
    ScrollView: el('ScrollView'),
  }
})

vi.mock('@/components/chrome-glyph', () => ({ ChromeGlyph: () => null }))
vi.mock('@/components/panel-chrome', () => {
  const React = require('react') as typeof import('react')
  return {
    ActionSheet: () => null,
    ConfirmDialog: () => null,
    EmptyNote: ({ title, testID }: { title: string; testID?: string }) =>
      React.createElement('div', { 'data-testid': testID }, title),
    ErrorNote: ({ message, testID }: { message: string; testID?: string }) =>
      React.createElement('div', { 'data-testid': testID }, message),
    PanelLabel: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  }
})
vi.mock('@/components/ui/button', () => {
  const React = require('react') as typeof import('react')
  return {
    Button: ({
      children,
      testID,
      onPress,
    }: {
      children?: React.ReactNode
      testID?: string
      onPress?: () => void
    }) =>
      React.createElement(
        'button',
        { type: 'button', 'data-testid': testID, onClick: onPress },
        children,
      ),
  }
})
vi.mock('@/components/ui/text', () => {
  const React = require('react') as typeof import('react')
  return {
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
  }
})
vi.mock('./card-composer', () => ({ CardComposer: () => null }))

describe('BoardCompanion', () => {
  beforeEach(() => {
    ctx.client = null
  })

  it('shows Focus card actions and test ids for the default Doing card', async () => {
    const { client, wrapper: Wrapper } = createBoardHarness()
    ctx.client = client
    render(
      <Wrapper>
        <BoardCompanion active />
      </Wrapper>,
    )
    const doing = boardContractFixtures.listBoardCards.output.find((c) => c.status === 'doing')
    if (doing === undefined) throw new Error('expected doing card')
    await waitFor(() => expect(screen.getByTestId('porcelain-board-focus')).toBeInTheDocument())
    expect(screen.getByText(doing.title)).toBeInTheDocument()
    expect(screen.getByTestId('porcelain-board-focus-edit')).toBeInTheDocument()
    expect(screen.getByTestId('porcelain-board-focus-move')).toBeInTheDocument()
    expect(screen.getByTestId('porcelain-board-focus-delete')).toBeInTheDocument()
    expect(screen.getByTestId('porcelain-board-focus-start-review')).toBeInTheDocument()
  })

  it('shows empty Focus when the board has no cards', async () => {
    const { client, wrapper: Wrapper } = createBoardHarness({
      listBoardCards: () => ({ ok: true, value: [] }),
    })
    ctx.client = client
    render(
      <Wrapper>
        <BoardCompanion active />
      </Wrapper>,
    )
    await waitFor(() =>
      expect(screen.getByTestId('porcelain-board-focus-empty')).toBeInTheDocument(),
    )
  })
})
