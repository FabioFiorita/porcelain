import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChangedFile, DiffStat } from './diff'
import {
  clearWorkingTreeSnapshot,
  type WorkingTreeSnapshot,
  workingTreeSnapshot,
} from './working-tree'

const files: ChangedFile[] = [{ path: 'a.ts', status: 'modified', staged: false, unstaged: true }]
const stats: DiffStat[] = [{ path: 'a.ts', additions: 1, deletions: 0 }]

function snapshot(): WorkingTreeSnapshot {
  return { files, stats }
}

describe('workingTreeSnapshot', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Distinct repo path per test so module-level cache entries don't bleed.
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('coalesces two concurrent calls onto one fetch', async () => {
    const fetch = vi.fn(async () => snapshot())
    const a = workingTreeSnapshot('/repo-concurrent', fetch)
    const b = workingTreeSnapshot('/repo-concurrent', fetch)
    const [ra, rb] = await Promise.all([a, b])
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(ra).toBe(rb)
  })

  it('serves the cached snapshot within the TTL (no re-fetch)', async () => {
    const fetch = vi.fn(async () => snapshot())
    const first = await workingTreeSnapshot('/repo-ttl-hit', fetch)
    vi.advanceTimersByTime(500)
    const second = await workingTreeSnapshot('/repo-ttl-hit', fetch)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(second).toBe(first)
  })

  it('re-fetches after the TTL expires', async () => {
    const fetch = vi.fn(async () => snapshot())
    await workingTreeSnapshot('/repo-ttl-expiry', fetch)
    vi.advanceTimersByTime(1000)
    await workingTreeSnapshot('/repo-ttl-expiry', fetch)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('evicts a rejected fetch so the next call re-fetches', async () => {
    const fetch = vi
      .fn<() => Promise<WorkingTreeSnapshot>>()
      .mockRejectedValueOnce(new Error('git blew up'))
      .mockResolvedValueOnce(snapshot())
    await expect(workingTreeSnapshot('/repo-reject', fetch)).rejects.toThrow('git blew up')
    // Immediately (same TTL window) — a cached rejection would re-throw here.
    const ok = await workingTreeSnapshot('/repo-reject', fetch)
    expect(ok).toEqual(snapshot())
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('clearWorkingTreeSnapshot forces the next call to re-fetch', async () => {
    const fetch = vi.fn(async () => snapshot())
    await workingTreeSnapshot('/repo-clear', fetch)
    clearWorkingTreeSnapshot('/repo-clear')
    await workingTreeSnapshot('/repo-clear', fetch)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('keeps different repo paths in separate entries', async () => {
    const fetchA = vi.fn(async () => snapshot())
    const fetchB = vi.fn(async () => snapshot())
    await workingTreeSnapshot('/repo-a', fetchA)
    await workingTreeSnapshot('/repo-b', fetchB)
    expect(fetchA).toHaveBeenCalledTimes(1)
    expect(fetchB).toHaveBeenCalledTimes(1)
  })
})
