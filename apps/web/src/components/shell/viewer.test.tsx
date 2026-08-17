import { useTabsStore } from '@renderer/stores/tabs'
import { TestIds } from '@shared/test-ids'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { Viewer } from './viewer'

describe('Viewer empty landing', () => {
  beforeEach(() => {
    useTabsStore.getState().closeAllTabs()
  })

  it('shows one empty state for every no-tab landing', () => {
    render(<Viewer />)
    const empty = screen.getByTestId(TestIds.viewerEmpty)
    expect(empty).toHaveAttribute('data-slot', 'empty')
    expect(empty).toHaveTextContent('Open a surface to get started')
    expect(empty).toHaveTextContent('Choose one from the Surfaces rail.')
    expect(screen.queryByTestId(TestIds.glance)).toBeNull()
    expect(screen.queryByTestId(TestIds.hubHome)).toBeNull()
    expect(screen.queryByTestId(TestIds.hubProjectSummary)).toBeNull()
  })
})
