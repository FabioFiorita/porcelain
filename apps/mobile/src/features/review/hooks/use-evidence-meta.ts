import type { UseQueryResult } from '@tanstack/react-query'
import { useIsFocused } from 'expo-router'

import type { DaemonError } from '@/lib/daemon/errors'
import { type EvidenceMeta, loopEvidenceQuery } from '@/lib/daemon/procedures/review'
import { useDaemonQuery } from '@/lib/daemon/queries'
import { useActiveRepo } from '@/lib/daemon/repo'

export function useEvidenceMeta(): UseQueryResult<EvidenceMeta | null, DaemonError> {
  const repo = useActiveRepo()
  const focused = useIsFocused()
  return useDaemonQuery(loopEvidenceQuery, repo?.path ?? '', {
    enabled: repo !== null && focused,
  })
}
