import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ctx = vi.hoisted(() => ({
  environment: { id: 'env-files-interest', token: 'paired' } as {
    id: string
    token: string | null
  },
  registrations: [] as { interest: unknown; release: ReturnType<typeof vi.fn> }[],
  repoPath: '/synthetic/repo',
}))

vi.mock('@/lib/daemon/environments-store', () => ({
  useActiveEnvironment: () => ctx.environment,
}))
vi.mock('@/lib/daemon/repo', () => ({
  useActiveRepo: () => ({ name: 'repo', path: ctx.repoPath }),
}))
vi.mock('@/lib/daemon/session', () => ({
  daemonSession: {
    registerWatchInterest: (interest: unknown) => {
      const release = vi.fn()
      ctx.registrations.push({ interest, release })
      return release
    },
  },
}))

import { useFilesDirectoryInterest, useFilesViewerInterest } from './files-interests'

beforeEach(() => {
  ctx.environment = { id: 'env-files-interest', token: 'paired' }
  ctx.registrations = []
})

describe('Files interest hooks', () => {
  it('registers a root directory with the RT-005 wrapper and releases before dispose', () => {
    const { unmount } = renderHook(() => useFilesDirectoryInterest('', true))
    expect(ctx.registrations).toHaveLength(1)
    expect(ctx.registrations[0]?.interest).toEqual({ dirs: ['/synthetic/repo'], files: [] })
    unmount()
    expect(ctx.registrations[0]?.release).toHaveBeenCalledTimes(1)
  })

  it('registers a relative viewer file and never calls the host while unpaired', () => {
    const first = renderHook(() => useFilesViewerInterest('src/main.ts', true))
    expect(ctx.registrations[0]?.interest).toEqual({
      dirs: [],
      files: ['/synthetic/repo/src/main.ts'],
    })
    first.unmount()

    ctx.registrations = []
    ctx.environment = { id: 'env-files-interest', token: null }
    const second = renderHook(() => useFilesViewerInterest('src/main.ts', true))
    expect(ctx.registrations).toHaveLength(0)
    second.unmount()
  })
})
