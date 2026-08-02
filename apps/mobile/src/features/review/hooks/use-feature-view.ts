import type { UseQueryResult } from '@tanstack/react-query'
import { useIsFocused } from 'expo-router'

import type { DaemonError } from '@/lib/daemon/errors'
import { type FeatureView, featureViewQuery } from '@/lib/daemon/procedures/review'
import { useDaemonQuery } from '@/lib/daemon/queries'
import { useActiveRepo } from '@/lib/daemon/repo'

export function useFeatureView(): UseQueryResult<FeatureView | null, DaemonError> {
  const repo = useActiveRepo()
  const focused = useIsFocused()
  return useDaemonQuery(featureViewQuery, repo?.path ?? '', {
    backstopMs: 10_000,
    enabled: repo !== null && focused,
    staleTime: 0,
  })
}
