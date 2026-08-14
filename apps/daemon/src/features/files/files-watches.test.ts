// @vitest-environment node
import type { SessionChange } from '@porcelain/contracts/session'
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import {
  createSessionFilesWatches,
  FILES_TREE_DEBOUNCE_MS,
  type FilesWatchHost,
  isGitChurn,
} from './files-watches'

/** The listener shape the host actually hands a watcher. */
type HostWatchListener = Parameters<FilesWatchHost['watch']>[1]

const PROJECT = '/synthetic/repo'

// `ReturnType<typeof vi.fn>` is `Mock<Procedure | Constructable>`, which is not callable as
// `() => void` — the fake could never satisfy FilesWatchHost. Real signatures inside Mock keep
// the call assertions and make the fake assignable to the port it stands in for.
type FakeWatcher = {
  close: Mock<() => void>
  on: Mock<(event: string, handler: () => void) => FakeWatcher>
  emitError: () => void
}

function createHarness() {
  const published: SessionChange[] = []
  const watchers = new Map<string, FakeWatcher>()
  // Typed to the port, not to node:fs. `WatchListener<string>` narrows `event` to
  // 'rename' | 'change', so the fake was not assignable to a host that passes `string` — and
  // the mismatch was invisible while test files went untypechecked.
  const listeners = new Map<string, HostWatchListener>()
  const watch = vi.fn<FilesWatchHost['watch']>((dir, listener) => {
    let errorHandler: (() => void) | undefined
    const fake: FakeWatcher = {
      close: vi.fn(() => {
        watchers.delete(dir)
        listeners.delete(dir)
      }),
      on: vi.fn((event: string, handler: () => void): FakeWatcher => {
        if (event === 'error') errorHandler = handler
        return fake
      }),
      emitError: () => {
        errorHandler?.()
      },
    }
    watchers.set(dir, fake)
    listeners.set(dir, listener)
    return fake
  })
  const setTimeoutFn = vi.fn((fn: () => void, _ms?: number) => {
    // Manual control via fake timers — store callback id via real setTimeout under fake timers.
    return globalThis.setTimeout(fn, _ms)
  })
  const clearTimeoutFn = vi.fn((id: ReturnType<typeof setTimeout>) => {
    globalThis.clearTimeout(id)
  })

  const watches = createSessionFilesWatches({
    publish: (change) => published.push(change),
    host: {
      watch,
      setTimeout: setTimeoutFn,
      clearTimeout: clearTimeoutFn,
    },
  })

  return {
    published,
    watch,
    watchers,
    listeners,
    watches,
    listenerFor: (dir: string) => listeners.get(dir),
    watcherFor: (dir: string) => watchers.get(dir),
  }
}

describe('isGitChurn', () => {
  it('flags a bare .git entry and anything beneath it', () => {
    expect(isGitChurn('.git')).toBe(true)
    expect(isGitChurn('.git/index')).toBe(true)
    expect(isGitChurn('.git/refs/heads/main')).toBe(true)
  })

  it('passes real source paths and a missing filename through', () => {
    expect(isGitChurn('src/index.ts')).toBe(false)
    expect(isGitChurn('.gitignore')).toBe(false)
    expect(isGitChurn(null)).toBe(false)
  })
})

describe('createSessionFilesWatches', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('publishes content-changed for a matching basename with a relative path', () => {
    const h = createHarness()
    h.watches.apply({
      projectPath: PROJECT,
      files: [`${PROJECT}/src/open.ts`],
      dirs: [],
    })

    h.listenerFor(`${PROJECT}/src`)?.('change', 'open.ts')

    expect(h.published).toEqual([
      {
        kind: 'files.content-changed',
        projectPath: PROJECT,
        paths: ['src/open.ts'],
      },
    ])
  })

  it('ignores a non-open basename under a file-interest parent', () => {
    const h = createHarness()
    h.watches.apply({
      projectPath: PROJECT,
      files: [`${PROJECT}/src/open.ts`],
      dirs: [],
    })

    h.listenerFor(`${PROJECT}/src`)?.('change', 'other.ts')

    expect(h.published).toEqual([])
  })

  it('publishes every interested file under a parent when filename is omitted', () => {
    const h = createHarness()
    h.watches.apply({
      projectPath: PROJECT,
      files: [`${PROJECT}/src/a.ts`, `${PROJECT}/src/b.ts`],
      dirs: [],
    })

    h.listenerFor(`${PROJECT}/src`)?.('rename', null)

    expect(h.published).toEqual([
      {
        kind: 'files.content-changed',
        projectPath: PROJECT,
        paths: ['src/a.ts', 'src/b.ts'],
      },
    ])
  })

  it('debounces tree events into one fact with first-seen path order', () => {
    const h = createHarness()
    h.watches.apply({
      projectPath: PROJECT,
      files: [],
      dirs: [`${PROJECT}/src`],
    })

    h.listenerFor(`${PROJECT}/src`)?.('rename', 'new.ts')
    h.listenerFor(`${PROJECT}/src`)?.('rename', 'other.ts')
    expect(h.published).toEqual([])

    vi.advanceTimersByTime(FILES_TREE_DEBOUNCE_MS)

    expect(h.published).toEqual([
      {
        kind: 'files.tree-changed',
        projectPath: PROJECT,
        paths: ['src', 'src/new.ts', 'src/other.ts'],
      },
    ])
  })

  it('drops .git churn from tree publishes', () => {
    const h = createHarness()
    h.watches.apply({
      projectPath: PROJECT,
      files: [],
      dirs: [PROJECT],
    })

    h.listenerFor(PROJECT)?.('change', '.git')
    h.listenerFor(PROJECT)?.('change', '.git/index')
    vi.advanceTimersByTime(FILES_TREE_DEBOUNCE_MS)

    expect(h.published).toEqual([])
  })

  it('does not re-cap directory watches (150 dirs → 150 watchers)', () => {
    const h = createHarness()
    const dirs = Array.from({ length: 150 }, (_, i) => `${PROJECT}/d${i}`)
    h.watches.apply({ projectPath: PROJECT, files: [], dirs })

    expect(h.watch).toHaveBeenCalledTimes(150)
  })

  it('shares one watcher for file and tree interest on the same directory', () => {
    const h = createHarness()
    h.watches.apply({
      projectPath: PROJECT,
      files: [`${PROJECT}/src/open.ts`],
      dirs: [`${PROJECT}/src`],
    })

    expect(h.watch).toHaveBeenCalledTimes(1)

    h.listenerFor(`${PROJECT}/src`)?.('change', 'open.ts')
    expect(h.published).toEqual([
      {
        kind: 'files.content-changed',
        projectPath: PROJECT,
        paths: ['src/open.ts'],
      },
    ])

    vi.advanceTimersByTime(FILES_TREE_DEBOUNCE_MS)
    expect(h.published).toEqual([
      {
        kind: 'files.content-changed',
        projectPath: PROJECT,
        paths: ['src/open.ts'],
      },
      {
        kind: 'files.tree-changed',
        projectPath: PROJECT,
        paths: ['src', 'src/open.ts'],
      },
    ])
  })

  it('reconciles drop/add without reopening an unchanged directory', () => {
    const h = createHarness()
    h.watches.apply({
      projectPath: PROJECT,
      files: [],
      dirs: [`${PROJECT}/src`, `${PROJECT}/lib`],
    })
    const srcWatcher = h.watcherFor(`${PROJECT}/src`)
    const libWatcher = h.watcherFor(`${PROJECT}/lib`)
    expect(h.watch).toHaveBeenCalledTimes(2)

    h.watches.apply({
      projectPath: PROJECT,
      files: [],
      dirs: [`${PROJECT}/lib`, `${PROJECT}/app`],
    })

    expect(srcWatcher?.close).toHaveBeenCalled()
    expect(libWatcher?.close).not.toHaveBeenCalled()
    expect(h.watch).toHaveBeenCalledTimes(3)
    expect(h.watcherFor(`${PROJECT}/app`)).toBeDefined()
  })

  it('clear is idempotent and cancels pending tree debounce', () => {
    const h = createHarness()
    h.watches.apply({
      projectPath: PROJECT,
      files: [],
      dirs: [`${PROJECT}/src`],
    })
    const w = h.watcherFor(`${PROJECT}/src`)

    h.listenerFor(`${PROJECT}/src`)?.('rename', 'a.ts')
    h.watches.clear()
    h.watches.clear()
    vi.advanceTimersByTime(FILES_TREE_DEBOUNCE_MS)

    expect(w?.close).toHaveBeenCalled()
    expect(h.published).toEqual([])
  })

  it('project-root change clears pending state before the new frame', () => {
    const h = createHarness()
    h.watches.apply({
      projectPath: PROJECT,
      files: [],
      dirs: [`${PROJECT}/src`],
    })
    h.listenerFor(`${PROJECT}/src`)?.('rename', 'a.ts')

    h.watches.apply({
      projectPath: '/synthetic/other',
      files: [],
      dirs: ['/synthetic/other/src'],
    })
    vi.advanceTimersByTime(FILES_TREE_DEBOUNCE_MS)

    expect(h.published).toEqual([])
  })

  it('ignores a queued callback from a watcher replaced with a new project frame', () => {
    const h = createHarness()
    h.watches.apply({
      projectPath: '/synthetic',
      files: [],
      dirs: [`${PROJECT}/src`],
    })
    const staleListener = h.listenerFor(`${PROJECT}/src`)

    h.watches.apply({
      projectPath: PROJECT,
      files: [],
      dirs: [`${PROJECT}/src`],
    })
    staleListener?.('rename', 'stale.ts')
    vi.advanceTimersByTime(FILES_TREE_DEBOUNCE_MS)

    expect(h.published).toEqual([])
  })

  it('publishes "." when the watched directory is the project root', () => {
    const h = createHarness()
    h.watches.apply({
      projectPath: PROJECT,
      files: [],
      dirs: [PROJECT],
    })

    h.listenerFor(PROJECT)?.('rename', 'README.md')
    vi.advanceTimersByTime(FILES_TREE_DEBOUNCE_MS)

    expect(h.published).toEqual([
      {
        kind: 'files.tree-changed',
        projectPath: PROJECT,
        paths: ['.', 'README.md'],
      },
    ])
  })

  it('skips unsupported watch installs and drops errored entries', () => {
    const h = createHarness()
    h.watch.mockImplementationOnce(() => {
      throw new Error('ENOSYS')
    })
    h.watches.apply({
      projectPath: PROJECT,
      files: [],
      dirs: [`${PROJECT}/bad`, `${PROJECT}/good`],
    })

    expect(h.watch).toHaveBeenCalledTimes(2)
    expect(h.watcherFor(`${PROJECT}/bad`)).toBeUndefined()
    expect(h.watcherFor(`${PROJECT}/good`)).toBeDefined()

    h.watcherFor(`${PROJECT}/good`)?.emitError()
    expect(h.watcherFor(`${PROJECT}/good`)).toBeUndefined()
  })

  it('reapplying the same frame creates no additional watcher', () => {
    const h = createHarness()
    const frame = {
      projectPath: PROJECT,
      files: [`${PROJECT}/src/a.ts`],
      dirs: [`${PROJECT}/src`],
    }
    h.watches.apply(frame)
    h.watches.apply(frame)
    expect(h.watch).toHaveBeenCalledTimes(1)
  })
})
