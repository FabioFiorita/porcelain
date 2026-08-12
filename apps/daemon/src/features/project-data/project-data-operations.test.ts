// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type {
  ChannelDispositionValue,
  CompanionDispositionValue,
  Layer,
} from '@porcelain/contracts/project-data'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_LAYERS } from './default-layers'
import type {
  CompanionDispositionsPort,
  CompanionGitVisibilityPort,
  LayersDocument,
  NotesDocument,
} from './project-data-capabilities'
import { createProjectDataOperations } from './project-data-operations'

const REPO = '/synthetic/repo'
const CHANNEL: ChannelDispositionValue = {
  key: 'notes',
  label: 'Notes',
  hint: 'Repository notes',
  disposition: 'shared',
  trackedPaths: ['.porcelain/notes.md'],
}

function fakeNotes(overrides: Partial<NotesDocument> = {}): NotesDocument {
  return {
    read: vi.fn(async () => ''),
    write: vi.fn(async () => undefined),
    ...overrides,
  }
}

function fakeLayers(overrides: Partial<LayersDocument> = {}): LayersDocument {
  return {
    read: vi.fn(async () => null),
    write: vi.fn(async () => undefined),
    ...overrides,
  }
}

function fakeDispositions(
  overrides: Partial<CompanionDispositionsPort> = {},
): CompanionDispositionsPort {
  return {
    read: vi.fn(async () => [CHANNEL]),
    set: vi.fn(async () => ({ untracked: [], revealed: false })),
    recordPublishedReview: vi.fn(async () => undefined),
    ...overrides,
  }
}

function fakeVisibility(
  overrides: Partial<CompanionGitVisibilityPort> = {},
): CompanionGitVisibilityPort {
  return {
    read: vi.fn(async () => ({ hidden: true })),
    set: vi.fn(async () => ({ changed: true })),
    ...overrides,
  }
}

describe('Project Data operations', () => {
  it('maps a missing layers document to the starter set and a stored set to custom', async () => {
    const empty = fakeLayers()
    const storedLayers: Layer[] = [{ label: 'Specs', pattern: '(^|/)plans/' }]
    const custom = fakeLayers({ read: vi.fn(async () => storedLayers) })

    await expect(createProjectDataOperations({ layers: empty }).repoLayers(REPO)).resolves.toEqual({
      layers: DEFAULT_LAYERS,
      custom: false,
    })
    expect(empty.read).toHaveBeenCalledWith(REPO)

    await expect(createProjectDataOperations({ layers: custom }).repoLayers(REPO)).resolves.toEqual(
      { layers: storedLayers, custom: true },
    )
    expect(custom.read).toHaveBeenCalledWith(REPO)
  })

  it('writes setRepoLayers(null) through the layers port', async () => {
    const write = vi.fn(async () => undefined)
    const layers = fakeLayers({ write })
    const operations = createProjectDataOperations({ layers })

    await expect(
      operations.setRepoLayers({ repoPath: REPO, layers: null }),
    ).resolves.toBeUndefined()
    expect(write).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledWith(REPO, null)
  })

  it('forwards notes, dispositions, visibility, and recordPublishedReview as one port call each', async () => {
    const notes = fakeNotes({
      read: vi.fn(async () => 'Ship the review layer.'),
      write: vi.fn(async () => undefined),
    })
    const dispositions = fakeDispositions({
      set: vi.fn(async () => ({ untracked: ['.porcelain/board.json'], revealed: false })),
    })
    const visibility = fakeVisibility({
      set: vi.fn(async () => ({ changed: false })),
    })
    const operations = createProjectDataOperations({ notes, dispositions, visibility })

    await expect(operations.repoNotes(REPO)).resolves.toBe('Ship the review layer.')
    expect(notes.read).toHaveBeenCalledTimes(1)
    expect(notes.read).toHaveBeenCalledWith(REPO)

    await operations.setRepoNotes({ repoPath: REPO, notes: 'next' })
    expect(notes.write).toHaveBeenCalledTimes(1)
    expect(notes.write).toHaveBeenCalledWith(REPO, 'next')

    await expect(operations.companionDispositions(REPO)).resolves.toEqual([CHANNEL])
    expect(dispositions.read).toHaveBeenCalledTimes(1)
    expect(dispositions.read).toHaveBeenCalledWith(REPO)

    const disposition: CompanionDispositionValue = 'local'
    await expect(
      operations.setCompanionDisposition({ repoPath: REPO, key: 'board', disposition }),
    ).resolves.toEqual({ untracked: ['.porcelain/board.json'], revealed: false })
    expect(dispositions.set).toHaveBeenCalledTimes(1)
    expect(dispositions.set).toHaveBeenCalledWith(REPO, 'board', disposition)

    await expect(operations.companionGitVisibility(REPO)).resolves.toEqual({ hidden: true })
    expect(visibility.read).toHaveBeenCalledTimes(1)
    expect(visibility.read).toHaveBeenCalledWith(REPO)

    await expect(
      operations.setCompanionGitVisibility({ repoPath: REPO, hidden: false }),
    ).resolves.toEqual({ changed: false })
    expect(visibility.set).toHaveBeenCalledTimes(1)
    expect(visibility.set).toHaveBeenCalledWith(REPO, false)

    await operations.recordPublishedReview(REPO, 'archive-1')
    expect(dispositions.recordPublishedReview).toHaveBeenCalledTimes(1)
    expect(dispositions.recordPublishedReview).toHaveBeenCalledWith(REPO, 'archive-1')
  })

  it('does not import trpc, routers, or expectedFailure', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./project-data-operations.ts', import.meta.url)),
      'utf8',
    )
    expect(source).not.toMatch(/\btrpc\b/)
    expect(source).not.toMatch(/expectedFailure/)
    expect(source).not.toMatch(/router\//)
  })
})
