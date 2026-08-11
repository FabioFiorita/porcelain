import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const setActive = vi.fn()
const pairNewGroup = vi.fn()

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
}))

vi.mock('@/lib/daemon/environments-store', () => ({
  environmentActions: {
    setActive: (...args: unknown[]) => setActive(...args),
  },
  getEnvironment: vi.fn(),
}))

vi.mock('./pair-environment', () => ({
  addGroupConnection: vi.fn(),
  describePairProblem: (problem: { kind: string }) => `pair:${problem.kind}`,
  pairNewGroup: (...args: unknown[]) => pairNewGroup(...args),
}))

import { useCreateGroupForm } from './use-environments-panel'

describe('useCreateGroupForm pairing totalness', () => {
  beforeEach(() => {
    setActive.mockReset()
    pairNewGroup.mockReset()
  })

  async function flush(): Promise<void> {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  }

  it('routes unexpected rejection to error and clears busy', async () => {
    pairNewGroup.mockRejectedValueOnce(new Error('network down'))
    const onCreated = vi.fn()
    const { result } = renderHook(() => useCreateGroupForm(onCreated))

    await act(async () => {
      result.current.setLink('https://host/pair#token=abc')
    })

    await act(async () => {
      result.current.submit()
      await flush()
    })

    expect(result.current.busy).toBe(false)
    expect(result.current.error).toBe('network down')
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('submit returns undefined at sync UI edges and recovers busy after success', async () => {
    pairNewGroup.mockResolvedValueOnce({
      ok: true,
      value: { id: 'env-new' },
    })
    setActive.mockResolvedValueOnce(undefined)
    const onCreated = vi.fn()
    const { result } = renderHook(() => useCreateGroupForm(onCreated))

    await act(async () => {
      result.current.setLink('https://host/pair#token=abc')
    })

    let returned: unknown
    await act(async () => {
      returned = result.current.submit()
      await flush()
    })

    expect(returned).toBeUndefined()
    expect(result.current.busy).toBe(false)
    expect(result.current.error).toBeNull()
    expect(onCreated).toHaveBeenCalledWith('env-new')
  })
})
