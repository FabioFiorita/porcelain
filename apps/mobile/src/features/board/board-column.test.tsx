import { boardContractFixtures } from '@porcelain/contracts/board'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BoardColumn } from './board-column'
import { createBoardHarness, PAIRED_ENV, REPO, type TestDaemonClient } from './test-support'

const CARDS = boardContractFixtures.listBoardCards.output

const ctx = vi.hoisted(() => ({
  client: null as TestDaemonClient | null,
}))

vi.mock('@/lib/daemon/client', () => ({
  getDaemonClient: (): TestDaemonClient => {
    if (ctx.client === null) throw new Error('test client not installed')
    return ctx.client
  },
}))

vi.mock('@/lib/daemon/repo', () => ({
  useActiveRepo: () => ({ path: REPO, name: 'repo' }),
}))

vi.mock('@/lib/daemon/environments-store', () => ({
  useActiveEnvironment: () => PAIRED_ENV,
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
      ..._rest
    }: {
      children?: React.ReactNode
      testID?: string
      accessibilityLabel?: string
      onPress?: () => void
      [key: string]: unknown
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

vi.mock('@/components/chrome-glyph', () => ({
  ChromeGlyph: () => null,
}))

vi.mock('@/components/panel-chrome', () => {
  const React = require('react') as typeof import('react')
  return {
    ConfirmDialog: ({
      open,
      testID,
      title,
      onConfirm,
    }: {
      open: boolean
      testID?: string
      title?: string
      onConfirm?: () => void
    }) =>
      open
        ? React.createElement(
            'div',
            { 'data-testid': testID },
            title,
            React.createElement('button', { type: 'button', onClick: onConfirm }, 'Clear'),
          )
        : null,
    ErrorNote: ({ message, testID }: { message: string; testID?: string }) =>
      React.createElement('div', { 'data-testid': testID }, message),
    IconAction: ({
      accessibilityLabel,
      testID,
      onPress,
      disabled,
    }: {
      accessibilityLabel?: string
      testID?: string
      onPress?: () => void
      disabled?: boolean
    }) =>
      React.createElement(
        'button',
        {
          'data-testid': testID,
          'aria-label': accessibilityLabel,
          type: 'button',
          disabled,
          onClick: onPress,
        },
        accessibilityLabel,
      ),
    PanelLabel: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  }
})

describe('BoardColumn', () => {
  beforeEach(() => {
    const { client } = createBoardHarness()
    ctx.client = client
  })

  it('renders visible cards, empty state, add and clear test ids', async () => {
    const { wrapper: Wrapper } = createBoardHarness()
    const todo = CARDS.filter((c) => c.status === 'todo')
    render(
      <Wrapper>
        <BoardColumn
          cards={todo}
          host="list"
          selectedId={null}
          status="todo"
          testIDPrefix="porcelain-board-list"
          onSelect={() => {}}
        />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('porcelain-board-list-column-todo')).toBeInTheDocument()
    })
    expect(screen.getByText((todo[0] as (typeof todo)[number]).title)).toBeInTheDocument()
    expect(screen.getByTestId('porcelain-board-list-add-todo')).toBeInTheDocument()
    expect(screen.getByLabelText('Add a card to To do')).toBeInTheDocument()
  })

  it('shows empty copy when the column has no cards', () => {
    const { wrapper: Wrapper } = createBoardHarness()
    render(
      <Wrapper>
        <BoardColumn
          cards={[]}
          host="list"
          selectedId={null}
          status="doing"
          testIDPrefix="porcelain-board-list"
          onSelect={() => {}}
        />
      </Wrapper>,
    )
    expect(screen.getByTestId('porcelain-board-list-column-empty-doing')).toHaveTextContent(
      'No cards yet',
    )
  })
})
