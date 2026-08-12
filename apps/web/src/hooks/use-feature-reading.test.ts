import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFeatureReading } from './use-feature-reading'

const featureReadingQuery = vi.hoisted(() => vi.fn())

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    featureReading: { useQuery: featureReadingQuery },
  },
}))

const aRepo = { path: '/repo', name: 'repo' }

beforeEach(() => {
  vi.clearAllMocks()
  useProjectSelectionStore.setState({ project: null })
  featureReadingQuery.mockReturnValue({ data: undefined, refetch: vi.fn() })
})

describe('useFeatureReading', () => {
  it('disables the query and returns undefined with no repo selected', () => {
    const { result } = renderHook(() => useFeatureReading())
    expect(featureReadingQuery).toHaveBeenCalledWith(
      '',
      expect.objectContaining({ enabled: false }),
    )
    expect(result.current.reading).toBeUndefined()
  })

  it('reports null as the documented "no review yet" state, not undefined', () => {
    useProjectSelectionStore.setState({ project: aRepo })
    featureReadingQuery.mockReturnValue({ data: null, refetch: vi.fn() })
    const { result } = renderHook(() => useFeatureReading())
    expect(featureReadingQuery).toHaveBeenCalledWith(
      aRepo.path,
      expect.objectContaining({ enabled: true }),
    )
    expect(result.current.reading).toBeNull()
  })

  it('passes through a real reading', () => {
    useProjectSelectionStore.setState({ project: aRepo })
    const reading = { name: 'Feature', sections: [], groups: [], evidence: null }
    featureReadingQuery.mockReturnValue({ data: reading, refetch: vi.fn() })
    const { result } = renderHook(() => useFeatureReading())
    expect(result.current.reading).toBe(reading)
  })

  it('refresh() refetches the query', async () => {
    useProjectSelectionStore.setState({ project: aRepo })
    const refetch = vi.fn().mockResolvedValue(undefined)
    featureReadingQuery.mockReturnValue({ data: null, refetch })
    const { result } = renderHook(() => useFeatureReading())

    await result.current.refresh()

    expect(refetch).toHaveBeenCalled()
  })
})
