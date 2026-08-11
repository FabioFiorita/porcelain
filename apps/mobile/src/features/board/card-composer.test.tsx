import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useBoardStore } from './board-store'
import { CardComposer } from './card-composer'
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
    ({ children, testID }: { children?: React.ReactNode; testID?: string }) =>
      React.createElement(tag === 'Text' ? 'span' : 'div', { 'data-testid': testID }, children)
  return {
    View: el('View'),
    Text: el('Text'),
  }
})

vi.mock('@/components/shell-modal', () => {
  const React = require('react') as typeof import('react')
  return {
    ShellModal: ({
      children,
      open,
      title,
    }: {
      children?: React.ReactNode
      open: boolean
      title?: string
    }) =>
      open
        ? React.createElement(
            'div',
            { 'data-testid': 'shell-modal', role: 'dialog' },
            title,
            children,
          )
        : null,
    useShellModalSize: () => ({ width: 360 }),
  }
})

vi.mock('@/components/segmented-control', () => {
  const React = require('react') as typeof import('react')
  return {
    SegmentedControl: ({ testID }: { testID?: string }) =>
      React.createElement('div', { 'data-testid': testID }),
  }
})

vi.mock('@/components/ui/button', () => {
  const React = require('react') as typeof import('react')
  return {
    Button: ({
      children,
      testID,
      onPress,
      disabled,
    }: {
      children?: React.ReactNode
      testID?: string
      onPress?: () => void
      disabled?: boolean
    }) =>
      React.createElement(
        'button',
        { type: 'button', 'data-testid': testID, onClick: onPress, disabled },
        children,
      ),
  }
})

vi.mock('@/components/ui/input', () => {
  const React = require('react') as typeof import('react')
  return {
    Input: ({
      value,
      onChangeText,
      testID,
      accessibilityLabel,
    }: {
      value?: string
      onChangeText?: (value: string) => void
      testID?: string
      accessibilityLabel?: string
    }) =>
      React.createElement('input', {
        'data-testid': testID,
        'aria-label': accessibilityLabel,
        value,
        onChange: (event: { target: { value: string } }) => onChangeText?.(event.target.value),
      }),
  }
})

vi.mock('@/components/ui/textarea', () => {
  const React = require('react') as typeof import('react')
  return {
    Textarea: ({
      value,
      onChangeText,
      testID,
      accessibilityLabel,
    }: {
      value?: string
      onChangeText?: (value: string) => void
      testID?: string
      accessibilityLabel?: string
    }) =>
      React.createElement('textarea', {
        'data-testid': testID,
        'aria-label': accessibilityLabel,
        value,
        onChange: (event: { target: { value: string } }) => onChangeText?.(event.target.value),
      }),
  }
})

vi.mock('@/components/ui/text', () => {
  const React = require('react') as typeof import('react')
  return {
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
  }
})

describe('CardComposer', () => {
  beforeEach(() => {
    ctx.client = null
    useBoardStore.setState({ draft: null, focus: null, column: 'doing' })
  })

  it('opens a new-card draft with accessibility labels and saves through createBoardCard', async () => {
    const { client, wrapper: Wrapper, mock } = createBoardHarness()
    ctx.client = client
    useBoardStore.getState().openDraft({ body: '', host: 'list', status: 'todo', title: '' })

    render(
      <Wrapper>
        <CardComposer host="list" />
      </Wrapper>,
    )

    expect(screen.getByLabelText('Card title')).toBeInTheDocument()
    expect(screen.getByLabelText('Card details')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Card title'), { target: { value: 'New work' } })
    fireEvent.click(screen.getByTestId('porcelain-board-composer-save'))

    await waitFor(() => {
      expect(mock.requests().some((r) => r.procedure === 'createBoardCard')).toBe(true)
    })
    expect(mock.requests().find((r) => r.procedure === 'createBoardCard')?.input).toMatchObject({
      projectPath: REPO,
      title: 'New work',
      status: 'todo',
    })
  })
})
