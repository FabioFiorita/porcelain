import { describe, expect, it } from 'vitest'
import {
  SESSION_WATCH_INTEREST_LIMIT,
  sessionWatchesFixtures,
  sessionWatchesFrameSchema,
} from './files-watches'

describe('Session watch interests', () => {
  it('accepts a complete desired set of files and directories', () => {
    expect(sessionWatchesFrameSchema.parse(sessionWatchesFixtures.watches)).toEqual(
      sessionWatchesFixtures.watches,
    )
  })

  it('accepts an empty desired set, which clears every interest', () => {
    expect(sessionWatchesFrameSchema.parse(sessionWatchesFixtures.empty)).toEqual(
      sessionWatchesFixtures.empty,
    )
  })

  it('requires projectPath, files, and dirs', () => {
    for (const field of ['projectPath', 'files', 'dirs'] as const) {
      const { [field]: _dropped, ...partial } = sessionWatchesFixtures.watches
      expect(sessionWatchesFrameSchema.safeParse(partial).success).toBe(false)
    }
    expect(
      sessionWatchesFrameSchema.safeParse({ ...sessionWatchesFixtures.watches, projectPath: '' })
        .success,
    ).toBe(false)
  })

  it('rejects empty path entries and unknown fields', () => {
    expect(
      sessionWatchesFrameSchema.safeParse({ ...sessionWatchesFixtures.watches, files: [''] })
        .success,
    ).toBe(false)
    expect(
      sessionWatchesFrameSchema.safeParse({ ...sessionWatchesFixtures.watches, dirs: [''] })
        .success,
    ).toBe(false)
    expect(
      sessionWatchesFrameSchema.safeParse({ ...sessionWatchesFixtures.watches, recursive: true })
        .success,
    ).toBe(false)
  })

  it('publishes the combined interest ceiling the daemon enforces', () => {
    expect(SESSION_WATCH_INTEREST_LIMIT).toBe(128)
  })

  it('parses a registration at the ceiling without truncating it', () => {
    const files = Array.from({ length: 64 }, (_, index) => `/synthetic/repo/file-${index}.ts`)
    const dirs = Array.from({ length: 64 }, (_, index) => `/synthetic/repo/dir-${index}`)
    const parsed = sessionWatchesFrameSchema.parse({
      t: 'session:watches',
      projectPath: '/synthetic/repo',
      files,
      dirs,
    })
    expect(parsed.files.length + parsed.dirs.length).toBe(SESSION_WATCH_INTEREST_LIMIT)
    expect(parsed.files).toEqual(files)
    expect(parsed.dirs).toEqual(dirs)
  })

  it('leaves an over-declared set for the daemon to bound rather than dropping the frame', () => {
    const files = Array.from(
      { length: SESSION_WATCH_INTEREST_LIMIT + 1 },
      (_, index) => `/synthetic/repo/file-${index}.ts`,
    )
    expect(
      sessionWatchesFrameSchema.safeParse({
        t: 'session:watches',
        projectPath: '/synthetic/repo',
        files,
        dirs: [],
      }).success,
    ).toBe(true)
  })
})
