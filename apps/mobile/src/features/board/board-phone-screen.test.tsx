import { boardContractFixtures } from '@porcelain/contracts/board'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BoardPhoneScreen } from './board-phone-screen'
import { useBoardStore } from './board-store'
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

vi.mock('expo-router', () => ({
  useIsFocused: () => true,
}))

vi.mock('@/features/shell/use-app-window', () => ({
  useIsTablet: () => false,
}))

vi.mock('@/features/shell/shell-store', () => ({
  useShellStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      openSheet: vi.fn(),
      setActiveSurface: vi.fn(),
      closeSheet: vi.fn(),
    }),
}))

vi.mock('@/features/shell/phone-header', () => {
  const React = require('react') as typeof import('react')
  return {
    PhoneHeader: ({ title }: { title: string }) =>
      React.createElement('div', { 'data-testid': 'phone-header' }, title),
  }
})

vi.mock('@/components/segmented-control', () => {
  const React = require('react') as typeof import('react')
  return {
    SegmentedControl: ({
      options,
      testID,
    }: {
      options: readonly { label: string; testID?: string; value: string }[]
      testID?: string
    }) =>
      React.createElement(
        'div',
        { 'data-testid': testID },
        options.map((option) =>
          React.createElement(
            'button',
            { key: option.value, type: 'button', 'data-testid': option.testID },
            option.label,
          ),
        ),
      ),
  }
})

vi.mock('@/components/surface-scroll', () => {
  const React = require('react') as typeof import('react')
  return {
    SurfaceScroll: ({ children, testID }: { children?: React.ReactNode; testID?: string }) =>
      React.createElement('div', { 'data-testid': testID }, children),
  }
})

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

describe('BoardPhoneScreen', () => {
  beforeEach(() => {
    ctx.client = null
    useBoardStore.setState({ column: 'doing', focus: null, draft: null })
  })

  it('renders phone surface, column tabs, and doing cards', async () => {
    const { client, wrapper: Wrapper } = createBoardHarness()
    ctx.client = client
    render(
      <Wrapper>
        <BoardPhoneScreen />
      </Wrapper>,
    )
    await waitFor(() =>
      expect(screen.getByTestId('porcelain-phone-surface-board')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('porcelain-board-phone-tabs')).toBeInTheDocument()
    expect(screen.getByTestId('porcelain-board-phone-tab-doing')).toBeInTheDocument()
    const doing = boardContractFixtures.listBoardCards.output.find((c) => c.status === 'doing')
    if (doing === undefined) throw new Error('expected doing card')
    await waitFor(() => expect(screen.getByText(doing.title)).toBeInTheDocument())
  })
})
