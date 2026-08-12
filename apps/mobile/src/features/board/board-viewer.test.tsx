import { boardContractFixtures } from '@porcelain/contracts/board'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BoardViewer } from './board-viewer'
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
    ConfirmDialog: () => null,
    EmptyNote: ({ title, testID }: { title: string; testID?: string }) =>
      React.createElement('div', { 'data-testid': testID }, title),
    ErrorNote: ({ message, testID }: { message: string; testID?: string }) =>
      React.createElement('div', { 'data-testid': testID }, message),
    IconAction: ({
      accessibilityLabel,
      testID,
      onPress,
    }: {
      accessibilityLabel?: string
      testID?: string
      onPress?: () => void
    }) =>
      React.createElement(
        'button',
        {
          type: 'button',
          'data-testid': testID,
          'aria-label': accessibilityLabel,
          onClick: onPress,
        },
        accessibilityLabel,
      ),
    PanelLabel: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  }
})
vi.mock('./card-composer', () => ({ CardComposer: () => null }))

describe('BoardViewer', () => {
  beforeEach(() => {
    ctx.client = null
  })

  it('renders tablet kanban cards and test ids against the public mock boundary', async () => {
    const { client, wrapper: Wrapper } = createBoardHarness()
    ctx.client = client
    render(
      <Wrapper>
        <BoardViewer active />
      </Wrapper>,
    )
    await waitFor(() =>
      expect(
        screen.getByText(boardContractFixtures.listBoardCards.output[0]?.title ?? ''),
      ).toBeInTheDocument(),
    )
    expect(screen.getByTestId('porcelain-board-viewer')).toBeInTheDocument()
    expect(screen.getByTestId('porcelain-board-viewer-column-todo')).toBeInTheDocument()
  })

  it('surfaces a failed Board read distinctly from empty', async () => {
    const { client, wrapper: Wrapper } = createBoardHarness({
      listBoardCards: () => ({
        ok: false,
        error: {
          code: 'board.unavailable',
          category: 'unavailable',
          message: 'The board is unavailable.',
          retryable: true,
          requestId: '00000000-0000-4000-8000-000000000099',
        },
      }),
    })
    ctx.client = client
    render(
      <Wrapper>
        <BoardViewer active />
      </Wrapper>,
    )
    await waitFor(() =>
      expect(screen.getByTestId('porcelain-board-viewer-error')).toBeInTheDocument(),
    )
  })
})
