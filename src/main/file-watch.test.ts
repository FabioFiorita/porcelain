import { watch } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearWatchedFiles, setWatchedFiles } from './file-watch'

// Mock node:fs so `watch` records its args and hands back a fake watcher whose
// `close` we can spy on — no real fs.watch, no temp dirs, no timers. This makes
// the routing/teardown logic provable synchronously and timing-free, so it can't
// flake. node:path is NOT mocked, so dirname/basename stay real. The `default`
// mirror keeps vitest's CJS interop happy (node:fs is resolved via its default).
vi.mock('node:fs', () => {
  const watch = vi.fn(() => ({ close: vi.fn() }))
  return { watch, default: { watch } }
})

// Two fake senders that satisfy FileWatchSender with NO cast — the structural
// type is exactly what a plain object literal can provide.
const a = { send: vi.fn(), isDestroyed: () => false }
const b = { send: vi.fn(), isDestroyed: () => false }

// POSIX absolute paths so dirname/basename are predictable: '/ra' + 'a-open.txt'.
const fileA = '/ra/a-open.txt'
const fileB = '/rb/b-open.txt'

// The change-callback the production code registered for `dir`.
const listenerFor = (dir: string) => vi.mocked(watch).mock.calls.find(([d]) => d === dir)?.[1]

// The fake watcher object production code stored for `dir`.
const watcherFor = (dir: string) => {
  const i = vi.mocked(watch).mock.calls.findIndex(([d]) => d === dir)
  return vi.mocked(watch).mock.results[i]?.value
}

beforeEach(() => {
  a.send.mockClear()
  b.send.mockClear()
  vi.mocked(watch).mockClear()
})

afterEach(() => {
  // Reap module-level watcher state so it can't leak between tests.
  clearWatchedFiles(a)
  clearWatchedFiles(b)
})

describe('per-sender file watching', () => {
  it('routes a working-tree change only to the owning sender', () => {
    setWatchedFiles(a, [fileA])
    setWatchedFiles(b, [fileB])

    listenerFor('/ra')?.('change', 'a-open.txt')

    expect(a.send).toHaveBeenCalledWith('app-event', 'working-tree')
    expect(b.send).not.toHaveBeenCalled()
  })

  it('ignores a change to a non-open basename in a watched dir', () => {
    setWatchedFiles(a, [fileA])

    listenerFor('/ra')?.('change', 'unrelated.txt')

    expect(a.send).not.toHaveBeenCalled()
  })

  it('routes when the platform omits the filename', () => {
    setWatchedFiles(a, [fileA])

    listenerFor('/ra')?.('rename', null)

    expect(a.send).toHaveBeenCalledTimes(1)
    expect(a.send).toHaveBeenCalledWith('app-event', 'working-tree')
  })

  it('closes a sender watchers on clearWatchedFiles, leaving others', () => {
    setWatchedFiles(a, [fileA])
    setWatchedFiles(b, [fileB])
    const wa = watcherFor('/ra')
    const wb = watcherFor('/rb')

    clearWatchedFiles(a)

    expect(wa.close).toHaveBeenCalled()
    expect(wb.close).not.toHaveBeenCalled()
  })

  it('drops a sender watchers when set to an empty path list', () => {
    setWatchedFiles(a, [fileA])
    const wa = watcherFor('/ra')

    setWatchedFiles(a, [])

    expect(wa.close).toHaveBeenCalled()
  })

  it('does not send to a destroyed sender', () => {
    const dead = { send: vi.fn(), isDestroyed: () => true }
    setWatchedFiles(dead, ['/rc/c.txt'])

    listenerFor('/rc')?.('change', 'c.txt')

    expect(dead.send).not.toHaveBeenCalled()
    clearWatchedFiles(dead)
  })
})
