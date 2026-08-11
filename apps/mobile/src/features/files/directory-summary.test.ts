import { describe, expect, it } from 'vitest'

import { directorySummary } from './directory-summary'
import type { FileEntry } from './files-data'

function entry(path: string, kind: 'dir' | 'file'): FileEntry {
  return { absolutePath: `/repo/${path}`, hidden: false, kind, name: path, path, pinned: false }
}

const listing = [entry('src', 'dir'), entry('docs', 'dir'), entry('README.md', 'file')]
const shown = { reading: false, showHidden: false }

describe('directorySummary', () => {
  it('counts folders and files separately', () => {
    expect(directorySummary(listing, shown)).toBe('2 folders · 1 file')
  })

  it('singularizes each half on its own', () => {
    expect(directorySummary([entry('src', 'dir')], shown)).toBe('1 folder · 0 files')
    expect(directorySummary([entry('a.ts', 'file')], shown)).toBe('0 folders · 1 file')
  })

  it('says an empty folder is empty rather than saying nothing', () => {
    expect(directorySummary([], shown)).toBe('0 folders · 0 files')
  })

  it('says so while hidden entries are being shown', () => {
    // Without this the same count means two different things depending on a toggle off screen.
    expect(directorySummary(listing, { reading: false, showHidden: true })).toBe(
      '2 folders · 1 file · hidden shown',
    )
  })

  it('reports the read rather than a count it does not have yet', () => {
    expect(directorySummary([], { reading: true, showHidden: false })).toBe('Reading directory…')
  })
})
