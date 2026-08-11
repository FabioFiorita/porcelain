import { boardContractFixtures } from '@porcelain/contracts/board'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CardRow } from './card-row'

vi.mock('react-native', () => {
  const React = require('react') as typeof import('react')
  return {
    Pressable: ({
      children,
      testID,
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
      onPress,
    }: {
      children?: React.ReactNode
      testID?: string
      accessibilityLabel?: string
      accessibilityRole?: string
      accessibilityState?: { selected?: boolean }
      onPress?: () => void
    }) =>
      React.createElement(
        'button',
        {
          'data-testid': testID,
          'aria-label': accessibilityLabel,
          role: accessibilityRole,
          'aria-selected': accessibilityState?.selected,
          onClick: onPress,
          type: 'button',
        },
        children,
      ),
    Text: ({ children, testID }: { children?: React.ReactNode; testID?: string }) =>
      React.createElement('span', { 'data-testid': testID }, children),
  }
})

const CARD = boardContractFixtures.listBoardCards.output[0] as NonNullable<
  (typeof boardContractFixtures.listBoardCards.output)[0]
>

describe('CardRow', () => {
  it('renders title, body hint, accessibility label, and test id', () => {
    render(
      <CardRow
        card={CARD}
        selected
        testID={`porcelain-board-list-card-${CARD.id}`}
        onPress={() => {}}
      />,
    )
    expect(screen.getByTestId(`porcelain-board-list-card-${CARD.id}`)).toBeInTheDocument()
    expect(screen.getByText(CARD.title)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `${CARD.title}, To do` })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })
})
