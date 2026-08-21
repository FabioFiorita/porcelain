import { describe, expect, it, vi } from 'vitest'

// `chrome-glyph` imports `expo-symbols`, which imports React Native's Flow-typed entry point —
// jsdom cannot parse it. The symbol table is that module's business and is exercised where it
// renders; here the resolver is an identity so the assertions read as glyph names.
vi.mock('@/components/chrome-glyph', () => ({
  sfSymbolFor: (name: string): string => name,
}))

import { type RowMenuAction, rowMenuActions, rowMenuPress } from './row-menu-actions'

/**
 * The mapping, not the menu. `MenuView` renders a SwiftUI `ContextMenu` / a Compose
 * `DropdownMenu`, neither of which mounts in jsdom — but the part that can be wrong without
 * anyone noticing is the translation between our rows and the menu's item list, and that is
 * ordinary data.
 */
const ROWS: readonly RowMenuAction[] = [
  { glyph: 'pencil', id: 'rename', label: 'Rename', onPress: vi.fn() },
  { destructive: true, glyph: 'trash', id: 'delete', label: 'Delete', onPress: vi.fn() },
  { disabled: true, id: 'stage', label: 'Stage', onPress: vi.fn() },
]

describe('rowMenuActions', () => {
  it('carries the id, label, and destructive/disabled flags onto every item', () => {
    expect(rowMenuActions(ROWS)).toEqual([
      {
        attributes: { destructive: false, disabled: false },
        id: 'rename',
        image: 'pencil',
        title: 'Rename',
      },
      {
        attributes: { destructive: true, disabled: false },
        id: 'delete',
        image: 'trash',
        title: 'Delete',
      },
      {
        attributes: { destructive: false, disabled: true },
        id: 'stage',
        image: undefined,
        title: 'Stage',
      },
    ])
  })
})

describe('rowMenuPress', () => {
  it('runs the action the menu named', () => {
    const rename = vi.fn()
    const remove = vi.fn()
    const actions: RowMenuAction[] = [
      { id: 'rename', label: 'Rename', onPress: rename },
      { id: 'delete', label: 'Delete', onPress: remove },
    ]

    rowMenuPress(actions, 'delete')

    expect(remove).toHaveBeenCalledTimes(1)
    expect(rename).not.toHaveBeenCalled()
  })

  it('ignores an id the rows no longer carry rather than throwing', () => {
    // The menu is presented by the OS and can outlive a re-render of the list behind it.
    expect(() => {
      rowMenuPress(ROWS, 'gone')
    }).not.toThrow()
  })
})
