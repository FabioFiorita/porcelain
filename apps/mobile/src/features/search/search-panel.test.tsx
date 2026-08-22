import type { SearchResult } from '@porcelain/contracts/search'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ctx = vi.hoisted(() => ({
  useCodeSearch: vi.fn(),
  useFileSearch: vi.fn(),
}))

vi.mock('./search-data', () => ({
  useCodeSearch: ctx.useCodeSearch,
  useFileSearch: ctx.useFileSearch,
}))
vi.mock('@/lib/path-identities', () => ({
  pathTestId: (prefix: string, path: string) => `${prefix}-${path}`,
}))
vi.mock('@/components/chrome-glyph', () => ({ ChromeGlyph: () => null }))
vi.mock('@/components/panel-chrome', () => {
  const React = require('react') as typeof import('react')
  return {
    EmptyNote: ({ title, testID }: { title: string; testID?: string }) =>
      React.createElement('div', { 'data-testid': testID }, title),
    ErrorNote: ({ message, testID }: { message: string; testID?: string }) =>
      React.createElement('div', { 'data-testid': testID }, message),
    // The idle panel carries the recents roster, which draws both of these.
    IconAction: ({
      accessibilityLabel,
      onPress,
      testID,
    }: {
      accessibilityLabel: string
      onPress: () => void
      testID?: string
    }) =>
      React.createElement('button', {
        'aria-label': accessibilityLabel,
        'data-testid': testID,
        onClick: onPress,
        type: 'button',
      }),
    PanelLabel: ({ children }: { children: string }) => React.createElement('div', null, children),
  }
})
// `RecentSearches` asks the shell whether it is inside a sheet; the shell reaches expo-router,
// which reaches React Native, which this suite's jsdom parser cannot read.
vi.mock('@/features/shell/shell-sheets', () => ({ useDismissSheet: () => () => {} }))
vi.mock('@/components/ui/segmented-control', () => {
  const React = require('react') as typeof import('react')
  return {
    SegmentedControl: ({
      onChange,
      options,
      testID,
    }: {
      onChange: (value: string) => void
      options: readonly { label: string; testID?: string; value: string }[]
      testID?: string
    }) =>
      React.createElement(
        'div',
        { 'data-testid': testID },
        options.map((option) =>
          React.createElement(
            'button',
            {
              key: option.value,
              'data-testid': option.testID,
              onClick: () => onChange(option.value),
            },
            option.label,
          ),
        ),
      ),
  }
})
vi.mock('@/components/surface-layout', () => ({
  SURFACE_ROW: '',
  SURFACE_ROW_SELECTED: '',
  SURFACE_STACK_GAP: '',
  SURFACE_TOOLBAR: '',
}))
vi.mock('@/components/surface-scroll', () => {
  const React = require('react') as typeof import('react')
  return {
    SurfaceList: ({
      data,
      renderItem,
      testID,
    }: {
      data: readonly unknown[]
      renderItem: (args: { item: unknown }) => React.ReactNode
      testID?: string
    }) =>
      React.createElement(
        'div',
        { 'data-testid': testID },
        data.map((item, index) =>
          React.createElement(React.Fragment, { key: index }, renderItem({ item })),
        ),
      ),
    SurfaceScroll: ({ children, testID }: { children?: React.ReactNode; testID?: string }) =>
      React.createElement('div', { 'data-testid': testID }, children),
  }
})
vi.mock('@/components/ui/input', () => {
  const React = require('react') as typeof import('react')
  return {
    Input: ({
      onChangeText,
      ...props
    }: {
      onChangeText?: (value: string) => void
      [key: string]: unknown
    }) =>
      React.createElement('input', {
        ...props,
        onChange: (event: { target: { value: string } }) => onChangeText?.(event.target.value),
      }),
  }
})
vi.mock('@/components/ui/collapsible', () => {
  const React = require('react') as typeof import('react')
  return {
    Collapsible: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    CollapsibleContent: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    CollapsibleTrigger: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('button', { type: 'button' }, children),
  }
})
vi.mock('react-native', () => {
  const React = require('react') as typeof import('react')
  const element =
    (tag: string) =>
    ({
      children,
      onPress,
      testID,
      accessibilityLabel,
      ...props
    }: {
      children?: React.ReactNode
      onPress?: () => void
      testID?: string
      accessibilityLabel?: string
      [key: string]: unknown
    }) =>
      React.createElement(
        tag === 'Pressable' ? 'button' : tag === 'Text' ? 'span' : 'div',
        {
          ...props,
          'aria-label': accessibilityLabel,
          'data-testid': testID,
          onClick: onPress,
          type: tag === 'Pressable' ? 'button' : undefined,
        },
        children,
      )
  return { Pressable: element('Pressable'), Text: element('Text'), View: element('View') }
})

import { SearchPanel } from './search-panel'
import { useSearchStore } from './search-store'

const FILE_RESULT: SearchResult = { kind: 'file', path: 'src/main.ts' }

beforeEach(() => {
  useSearchStore.setState({
    caseSensitive: false,
    exclude: '',
    include: '',
    query: '',
    recentSearches: [],
    regex: false,
    searchMode: 'text',
    showFilters: false,
  })
  ctx.useCodeSearch.mockReturnValue({ error: null, isLoading: false, result: undefined })
  ctx.useFileSearch.mockReturnValue({ error: null, isLoading: false, results: [] })
})

describe('SearchPanel', () => {
  it('keeps Search mode and filter controls in the Search store', () => {
    const openDir = vi.fn()
    const openFile = vi.fn()
    render(<SearchPanel active onOpenDir={openDir} onOpenFile={openFile} />)

    fireEvent.click(screen.getByTestId('porcelain-search-filters-toggle'))
    fireEvent.click(screen.getByTestId('porcelain-search-mode-files'))

    expect(useSearchStore.getState().searchMode).toBe('files')
    expect(useSearchStore.getState().showFilters).toBe(true)
  })

  it('renders a file result and delegates opening to Files navigation', () => {
    useSearchStore.setState({ query: 'main', searchMode: 'files' })
    ctx.useFileSearch.mockReturnValue({ error: null, isLoading: false, results: [FILE_RESULT] })
    const openFile = vi.fn()
    render(<SearchPanel active onOpenDir={vi.fn()} onOpenFile={openFile} />)

    fireEvent.click(screen.getByTestId('porcelain-search-result-src/main.ts'))
    expect(openFile).toHaveBeenCalledWith('src/main.ts')
  })
})
