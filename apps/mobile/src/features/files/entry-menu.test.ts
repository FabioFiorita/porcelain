import { describe, expect, it } from 'vitest'

import { entryMenuAction, entryMenuOptions } from './entry-menu'

const path = '/repo/src/app.ts'

describe('entryMenuOptions', () => {
  it('offers Pin and Hide for a plain entry', () => {
    expect(entryMenuOptions({ hidden: false, path, pinned: false })).toEqual([
      'Pin',
      'Hide',
      'Copy path',
      'Cancel',
    ])
  })

  it('flips both labels with the entry state', () => {
    expect(entryMenuOptions({ hidden: true, path, pinned: true })).toEqual([
      'Unpin',
      'Unhide',
      'Copy path',
      'Cancel',
    ])
  })
})

describe('entryMenuAction', () => {
  it('pins an unpinned entry and unpins a pinned one', () => {
    expect(entryMenuAction({ hidden: false, path, pinned: false }, 0)).toEqual({
      kind: 'pin',
      path,
    })
    expect(entryMenuAction({ hidden: false, path, pinned: true }, 0)).toEqual({
      kind: 'unpin',
      path,
    })
  })

  it('hides a visible entry and unhides a hidden one', () => {
    expect(entryMenuAction({ hidden: false, path, pinned: false }, 1)).toEqual({
      kind: 'hide',
      path,
    })
    expect(entryMenuAction({ hidden: true, path, pinned: false }, 1)).toEqual({
      kind: 'unhide',
      path,
    })
  })

  it('copies on the third option and does nothing on cancel', () => {
    expect(entryMenuAction({ hidden: false, path, pinned: false }, 2)).toEqual({
      kind: 'copy',
      path,
    })
    expect(entryMenuAction({ hidden: false, path, pinned: false }, 3)).toBeNull()
    expect(entryMenuAction({ hidden: false, path, pinned: false }, 9)).toBeNull()
  })

  it('keeps every label paired with the action it runs', () => {
    for (const hidden of [false, true]) {
      for (const pinned of [false, true]) {
        const entry = { hidden, path, pinned }
        const options = entryMenuOptions(entry)
        for (const [index, label] of options.entries()) {
          const action = entryMenuAction(entry, index)
          if (label === 'Cancel') {
            expect(action).toBeNull()
            continue
          }
          expect(action).not.toBeNull()
          expect(label.toLowerCase().replace(' path', '')).toBe(action?.kind)
        }
      }
    }
  })
})
