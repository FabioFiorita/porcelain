import type { ActionView } from '@porcelain/contracts/actions'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const spawnTerminalSession = vi.fn(async () => 'term-1')
const project = vi.hoisted(() => ({
  current: { name: 'repo', path: '/synthetic/repo' } as { name: string; path: string } | null,
}))

vi.mock('@/features/projects', () => ({
  useActiveProject: () => project.current,
}))

vi.mock('@/features/terminal', () => ({
  spawnTerminalSession: (...args: unknown[]) => spawnTerminalSession(...args),
}))

import { useActionRun } from './action-run'

const trustedPrimary: ActionView = {
  id: 'a1',
  title: 'Build',
  command: 'make build',
  order: 1,
  createdAt: 1,
  trusted: true,
}

const untrusted: ActionView = {
  ...trustedPrimary,
  id: 'a3',
  trusted: false,
}

beforeEach(() => {
  spawnTerminalSession.mockReset()
  spawnTerminalSession.mockResolvedValue('term-1')
  project.current = { name: 'repo', path: '/synthetic/repo' }
})

describe('mobile useActionRun', () => {
  it('does not spawn when prepare refuses untrusted', async () => {
    const { result } = renderHook(() => useActionRun())
    await expect(result.current(untrusted)).rejects.toThrow(/not trusted/)
    expect(spawnTerminalSession).not.toHaveBeenCalled()
  })

  it('spawns once with prepared fields for a trusted primary action', async () => {
    const { result } = renderHook(() => useActionRun())
    await result.current(trustedPrimary)
    expect(spawnTerminalSession).toHaveBeenCalledTimes(1)
    expect(spawnTerminalSession).toHaveBeenCalledWith({
      cwd: '/synthetic/repo',
      name: 'Build',
      initialInput: 'make build',
    })
  })

  it('surfaces spawn failure', async () => {
    spawnTerminalSession.mockRejectedValueOnce(new Error('pty failed'))
    const { result } = renderHook(() => useActionRun())
    await expect(result.current(trustedPrimary)).rejects.toThrow('pty failed')
  })
})
