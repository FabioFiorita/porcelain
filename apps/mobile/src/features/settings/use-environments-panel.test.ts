import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Environment } from '@/lib/daemon/environment'

const remove = vi.fn()
const removeEndpoint = vi.fn()
const setIcon = vi.fn()
const setActive = vi.fn()
const preferEndpoint = vi.fn()
const setEndpointOrder = vi.fn()
const rename = vi.fn()
const getEnvironment = vi.fn()

vi.mock('react-native', () => ({
  Alert: {
    alert: vi.fn(
      (
        _title: string,
        _message: string,
        buttons?: Array<{ onPress?: () => void; text?: string; style?: string }>,
      ) => {
        const destructive = buttons?.find((button) => button.style === 'destructive')
        destructive?.onPress?.()
      },
    ),
  },
}))

vi.mock('@/lib/daemon/environments-store', () => ({
  environmentActions: {
    remove: (...args: unknown[]) => remove(...args),
    removeEndpoint: (...args: unknown[]) => removeEndpoint(...args),
    setIcon: (...args: unknown[]) => setIcon(...args),
    setActive: (...args: unknown[]) => setActive(...args),
    preferEndpoint: (...args: unknown[]) => preferEndpoint(...args),
    setEndpointOrder: (...args: unknown[]) => setEndpointOrder(...args),
    rename: (...args: unknown[]) => rename(...args),
  },
  getEnvironment: (...args: unknown[]) => getEnvironment(...args),
}))

import { useGroupDetail } from './use-environments-panel'

const environment = (overrides: Partial<Environment> = {}): Environment => ({
  activeRepoPath: null,
  baseUrl: 'http://192.168.1.10:43118',
  createdAt: 0,
  endpoints: ['http://192.168.1.10:43118', 'http://100.64.0.1:43118'],
  icon: 'desktop',
  id: 'env-1',
  nickname: 'Beelink',
  preferredEndpoint: 'http://192.168.1.10:43118',
  token: 'tok',
  ...overrides,
})

describe('useGroupDetail write failures', () => {
  beforeEach(() => {
    remove.mockReset()
    removeEndpoint.mockReset()
    setIcon.mockReset()
    setActive.mockReset()
    preferEndpoint.mockReset()
    setEndpointOrder.mockReset()
    rename.mockReset()
    getEnvironment.mockReset()
  })

  async function flush(): Promise<void> {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  }

  it('routes user-triggered write rejections to writeError without throwing', async () => {
    setIcon.mockRejectedValueOnce(new Error('secure store full'))
    const onDeleted = vi.fn()
    const { result } = renderHook(() => useGroupDetail(environment(), onDeleted))

    await act(async () => {
      result.current.setIcon('terminal')
      await flush()
    })

    expect(result.current.writeError).toBe('Could not update icon: secure store full')
  })

  it('routes environment deletion failure to writeError (not a nested Alert)', async () => {
    remove.mockRejectedValueOnce(new Error('index write failed'))
    const onDeleted = vi.fn()
    const { result } = renderHook(() => useGroupDetail(environment(), onDeleted))

    await act(async () => {
      result.current.confirmDelete()
      await flush()
    })

    expect(onDeleted).not.toHaveBeenCalled()
    expect(result.current.writeError).toBe('Could not delete environment: index write failed')
  })

  it('clears writeError after a later successful write', async () => {
    setActive.mockRejectedValueOnce(new Error('first fail')).mockResolvedValueOnce(undefined)
    const { result } = renderHook(() => useGroupDetail(environment(), vi.fn()))

    await act(async () => {
      result.current.use()
      await flush()
    })
    expect(result.current.writeError).toMatch(/Could not switch environment/)

    await act(async () => {
      result.current.use()
      await flush()
    })
    expect(result.current.writeError).toBeNull()
  })
})
