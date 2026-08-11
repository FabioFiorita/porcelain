import { describe, expect, it, vi } from 'vitest'
import type { WatchInterest, WatchInterestRegistration } from '../session/interests'
import { createFilesInterest, type FilesInterestHost } from './files-interests'
import { FilesIdentityError } from './files-queries'

function createFakeHost() {
  const registrations: Array<{
    interest: WatchInterest
    release: ReturnType<typeof vi.fn>
  }> = []

  const host: FilesInterestHost = {
    registerWatchInterest(interest) {
      const release = vi.fn()
      registrations.push({ interest, release })
      const registration: WatchInterestRegistration = { release }
      return registration
    },
  }

  return { host, registrations }
}

describe('createFilesInterest', () => {
  it('converts relative file and directory interests to absolute host paths', () => {
    const { host, registrations } = createFakeHost()
    const interest = createFilesInterest('/synthetic/repo', host)

    const fileHandle = interest.addFile('src/a.ts')
    const dirHandle = interest.addDirectory('src')
    const rootHandle = interest.addDirectory('.')

    expect(fileHandle).not.toBeNull()
    expect(dirHandle).not.toBeNull()
    expect(rootHandle).not.toBeNull()
    expect(registrations.map((r) => r.interest)).toEqual([
      { files: ['/synthetic/repo/src/a.ts'], dirs: [] },
      { files: [], dirs: ['/synthetic/repo/src'] },
      { files: [], dirs: ['/synthetic/repo'] },
    ])
  })

  it('joins project root "/" without double slash', () => {
    const { host, registrations } = createFakeHost()
    const interest = createFilesInterest('/', host)
    expect(interest.addFile('src/a')).not.toBeNull()
    expect(registrations[0]?.interest).toEqual({ files: ['/src/a'], dirs: [] })
    expect(interest.addDirectory('.')).not.toBeNull()
    expect(registrations[1]?.interest).toEqual({ files: [], dirs: ['/'] })
  })

  it('returns null and makes zero host calls for invalid paths', () => {
    const { host, registrations } = createFakeHost()
    const interest = createFilesInterest('/synthetic/repo', host)

    expect(interest.addFile('')).toBeNull()
    expect(interest.addFile('/abs')).toBeNull()
    expect(interest.addFile('.')).toBeNull()
    expect(interest.addDirectory('')).toBeNull()
    expect(interest.addDirectory('/abs')).toBeNull()
    expect(registrations).toHaveLength(0)
  })

  it('throws FilesIdentityError for invalid projectPath at construction', () => {
    const { host } = createFakeHost()
    expect(() => createFilesInterest('', host)).toThrow(FilesIdentityError)
    expect(() => createFilesInterest('relative', host)).toThrow(FilesIdentityError)
  })

  it('release calls host release once; second release is a no-op', () => {
    const { host, registrations } = createFakeHost()
    const interest = createFilesInterest('/synthetic/repo', host)
    const handle = interest.addFile('a.ts')
    expect(handle).not.toBeNull()
    handle?.release()
    handle?.release()
    expect(registrations[0]?.release).toHaveBeenCalledTimes(1)
  })

  it('held lists first-seen unique absolutes while two registers fire for the same path', () => {
    const { host, registrations } = createFakeHost()
    const interest = createFilesInterest('/synthetic/repo', host)
    const first = interest.addFile('a.ts')
    const second = interest.addFile('a.ts')
    expect(registrations).toHaveLength(2)
    expect(interest.held()).toEqual({
      files: ['/synthetic/repo/a.ts'],
      dirs: [],
    })
    first?.release()
    expect(interest.held()).toEqual({
      files: ['/synthetic/repo/a.ts'],
      dirs: [],
    })
    second?.release()
    expect(interest.held()).toEqual({ files: [], dirs: [] })
  })

  it('dispose is terminal and idempotent: later adds return null with zero host calls', () => {
    const { host, registrations } = createFakeHost()
    const interest = createFilesInterest('/synthetic/repo', host)
    const handle = interest.addFile('a.ts')
    const dir = interest.addDirectory('src')
    expect(registrations).toHaveLength(2)

    interest.dispose()
    interest.dispose()

    expect(registrations[0]?.release).toHaveBeenCalledTimes(1)
    expect(registrations[1]?.release).toHaveBeenCalledTimes(1)
    expect(interest.held()).toEqual({ files: [], dirs: [] })

    const before = registrations.length
    expect(interest.addFile('b.ts')).toBeNull()
    expect(interest.addDirectory('lib')).toBeNull()
    expect(registrations).toHaveLength(before)

    // already-released handles stay no-ops
    handle?.release()
    dir?.release()
    expect(registrations[0]?.release).toHaveBeenCalledTimes(1)
  })
})
