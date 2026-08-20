import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ctx = vi.hoisted(() => ({
  repoPath: '/synthetic/repo' as string | null,
}))

vi.mock('@/features/projects', () => ({
  useHubRepoPath: () => ctx.repoPath,
}))
vi.mock('./git-mutations', () => ({
  useApplyCommitGroups: () => ({ applyGroups: vi.fn(), isApplying: false }),
  useCommit: () => ({ commit: vi.fn(), error: null, isCommitting: false }),
  useCommitGeneration: () => ({
    generateGroups: vi.fn(),
    generateMessage: vi.fn(),
    isGenerating: false,
  }),
  useStageAll: () => ({ isStaging: false, stageAll: vi.fn(), unstageAll: vi.fn() }),
}))
vi.mock('./git-queries', () => ({
  useCommitConventions: () => ({ scopes: ['mobile'], types: ['feat', 'fix'] }),
  // One unstaged file: the composer is enabled, which is what a draft test needs.
  useWorkingFlow: () => [
    { layer: 'Surface', files: [{ path: 'apps/mobile/src/a.ts', staged: false }] },
  ],
}))
vi.mock('@/components/chrome-glyph', () => ({ ChromeGlyph: () => null }))
vi.mock('@/components/panel-chrome', () => {
  const React = require('react') as typeof import('react')
  return {
    PanelLabel: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    StatusNote: ({ testID, text }: { testID?: string; text: string }) =>
      React.createElement('div', { 'data-testid': testID }, text),
  }
})
vi.mock('@/components/surface-layout', () => ({ PANEL_CARD: '' }))
vi.mock('@/components/ui/button', () => {
  const React = require('react') as typeof import('react')
  return {
    Button: ({
      children,
      disabled,
      onPress,
      testID,
    }: {
      children?: React.ReactNode
      disabled?: boolean
      onPress?: () => void
      testID?: string
    }) =>
      React.createElement(
        'button',
        { 'data-testid': testID, disabled, onClick: onPress, type: 'button' },
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
vi.mock('@/components/ui/textarea', () => {
  const React = require('react') as typeof import('react')
  return {
    Textarea: ({
      onChangeText,
      placeholder,
      testID,
      value,
    }: {
      onChangeText?: (next: string) => void
      placeholder?: string
      testID?: string
      value?: string
    }) =>
      React.createElement('textarea', {
        'data-testid': testID,
        onChange: (event: { target: { value: string } }) => onChangeText?.(event.target.value),
        placeholder,
        value,
      }),
  }
})
vi.mock('@/components/ui/input', () => {
  const React = require('react') as typeof import('react')
  return {
    Input: ({ testID, value }: { testID?: string; value?: string }) =>
      React.createElement('input', { 'data-testid': testID, onChange: () => {}, value }),
  }
})
// The token picker's sheet is closed until the chip is pressed; render its body only when open
// so the chip's own id is what a closed card exposes.
vi.mock('@/components/native/native-sheet', () => {
  const React = require('react') as typeof import('react')
  return {
    NativeSheet: ({ children, open }: { children?: React.ReactNode; open: boolean }) =>
      open ? React.createElement('div', null, children) : null,
  }
})
vi.mock('react-native', () => {
  const React = require('react') as typeof import('react')
  const element =
    (tag: string) =>
    ({
      accessibilityLabel,
      children,
      onPress,
      testID,
    }: {
      accessibilityLabel?: string
      children?: React.ReactNode
      onPress?: () => void
      testID?: string
    }) =>
      React.createElement(
        tag === 'Pressable' ? 'button' : tag === 'Text' ? 'span' : 'div',
        {
          'aria-label': accessibilityLabel,
          'data-testid': testID,
          onClick: onPress,
          type: tag === 'Pressable' ? 'button' : undefined,
        },
        children,
      )
  return {
    Pressable: element('Pressable'),
    ScrollView: element('ScrollView'),
    Text: element('Text'),
    View: element('View'),
  }
})

import { useCommitDraftStore } from '@/features/changes/commit-draft-store'

import { GitCommitCard } from './git-commit-card'

const REPO = '/synthetic/repo'

beforeEach(() => {
  ctx.repoPath = REPO
  useCommitDraftStore.setState({ messages: {} })
})

afterEach(() => {
  useCommitDraftStore.setState({ messages: {} })
})

/**
 * The Git composer and `features/changes` share ONE draft store on purpose: a commit message
 * belongs to a repository, not to a screen. These two directions are that contract — a message
 * typed into the Git card is readable through the store any other surface reads, and a message
 * written through the store shows up in the Git card.
 */
describe('GitCommitCard draft sharing', () => {
  it('writes what is typed into the shared per-repo draft store', () => {
    render(<GitCommitCard active />)

    fireEvent.change(screen.getByTestId('porcelain-git-commit-message'), {
      target: { value: 'fix(mobile): one composer' },
    })

    expect(useCommitDraftStore.getState().messages).toEqual({
      [REPO]: 'fix(mobile): one composer',
    })
  })

  it('renders a draft written through the store by another surface', () => {
    render(<GitCommitCard active />)

    act(() => {
      useCommitDraftStore.getState().setMessage(REPO, 'feat(git): shared draft')
    })

    expect(screen.getByTestId('porcelain-git-commit-message')).toHaveValue(
      'feat(git): shared draft',
    )
  })

  it('keeps drafts separate per repository path', () => {
    useCommitDraftStore.getState().setMessage('/other/repo', 'someone else’s message')
    render(<GitCommitCard active />)

    expect(screen.getByTestId('porcelain-git-commit-message')).toHaveValue('')

    fireEvent.change(screen.getByTestId('porcelain-git-commit-message'), {
      target: { value: 'mine' },
    })

    expect(useCommitDraftStore.getState().messages).toEqual({
      '/other/repo': 'someone else’s message',
      [REPO]: 'mine',
    })
  })
})

/**
 * The composer borrows the Changes feature's token chip. Sharing the component must not share
 * its ids: the Git surface names its own controls.
 */
describe('GitCommitCard test ids', () => {
  it('names the shared token chips with the Git surface prefix', () => {
    render(<GitCommitCard active />)

    expect(screen.getByTestId('porcelain-git-commit-type')).toBeInTheDocument()
    expect(screen.getByTestId('porcelain-git-commit-scope')).toBeInTheDocument()
    expect(screen.queryByTestId('porcelain-changes-commit-type')).toBeNull()
    expect(screen.queryByTestId('porcelain-changes-commit-scope')).toBeNull()
  })
})
