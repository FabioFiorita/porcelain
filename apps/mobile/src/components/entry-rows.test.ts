import { describe, expect, it } from 'vitest'

import { type EntryItem, entryCanvasRows } from '@/components/entry-rows'
import { INDENT_COLUMNS, SYMBOL_COLUMNS } from '@/theme/list-canvas'

const scheme = 'dark' as const

type PathItem = Extract<EntryItem, { kind: 'dir' | 'file' }>

function dir(name: string, depth: number, expanded = false): PathItem {
  return { depth, expanded, key: `/repo/${name}`, kind: 'dir', name, path: `/repo/${name}` }
}

function file(name: string, depth: number): PathItem {
  return { depth, key: `/repo/${name}`, kind: 'file', name, path: `/repo/${name}` }
}

describe('entryCanvasRows', () => {
  it('lines a file up with the folders beside it in a tree', () => {
    const [folder, leaf] = entryCanvasRows([dir('src', 1), file('index.ts', 1)], {
      disclosure: true,
      scheme,
    })

    const folderText = (folder?.indent ?? 0) + (folder?.symbols?.length ?? 0) * SYMBOL_COLUMNS
    const leafText = (leaf?.indent ?? 0) + (leaf?.symbols?.length ?? 0) * SYMBOL_COLUMNS
    expect(folderText).toBe(leafText)
    expect(folder?.indent).toBe(INDENT_COLUMNS)
  })

  it('gives a folder a disclosure glyph only when the list has the column', () => {
    const [withTree] = entryCanvasRows([dir('src', 0)], { disclosure: true, scheme })
    const [flat] = entryCanvasRows([dir('src', 0)], { scheme })

    expect(withTree?.symbols).toHaveLength(2)
    expect(withTree?.symbols?.[0]?.name).toBe('chevron.right')
    expect(flat?.symbols).toHaveLength(1)
    expect(flat?.symbols?.[0]?.name).toBe('folder')
  })

  it('turns the chevron and the folder over when it opens', () => {
    const [row] = entryCanvasRows([dir('src', 0, true)], { disclosure: true, scheme })
    expect(row?.symbols?.map((symbol) => symbol.name)).toEqual(['chevron.down', 'folder.fill'])
  })

  it('keeps a caller-supplied glyph, so Changes can lead with git status', () => {
    const [row] = entryCanvasRows(
      [{ ...file('a.ts', 0), symbol: { name: 'plus.circle', tint: '#34C759' } }],
      { scheme },
    )
    expect(row?.symbols).toEqual([{ name: 'plus.circle', tint: '#34C759' }])
  })

  it('separates trailing columns and tints only what asks for it', () => {
    const [row] = entryCanvasRows(
      [{ ...file('a.ts', 0), trailing: [{ text: '+12', tint: '#34C759' }, { text: 'Staged' }] }],
      { scheme },
    )

    expect(row?.cells?.map((cell) => cell.text)).toEqual(['a.ts', '  +12', '  Staged'])
    expect(row?.cells?.[1]?.fg).toBe('#34C759')
    expect(row?.cells?.[1]?.fg).not.toBe(row?.cells?.[2]?.fg)
  })

  it('drops an empty trailing column instead of drawing two spaces', () => {
    const [row] = entryCanvasRows([{ ...file('a.ts', 0), trailing: [{ text: '' }] }], { scheme })
    expect(row?.cells).toHaveLength(1)
  })

  it('speaks a row rather than reading its columns out', () => {
    const [folder] = entryCanvasRows([{ ...dir('src', 0, true), trailing: [{ text: '12' }] }], {
      disclosure: true,
      scheme,
    })
    expect(folder?.label).toBe('src, folder, expanded, 12')
  })

  it('pins a section under the top edge', () => {
    const [row] = entryCanvasRows([{ key: 'pinned', kind: 'section', title: 'Pinned' }], { scheme })
    expect(row?.sticky).toBe(true)
    expect(row?.cells?.[0]?.text).toBe('PINNED')
    expect(row?.label).toBe('Pinned')
  })
})
