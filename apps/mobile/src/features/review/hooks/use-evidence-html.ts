import type { UseQueryResult } from '@tanstack/react-query'
import { useIsFocused } from 'expo-router'

import type { DaemonError } from '@/lib/daemon/errors'
import { type Evidence, loopEvidenceHtmlQuery } from '@/lib/daemon/procedures/review'
import { useDaemonQuery } from '@/lib/daemon/queries'
import { useActiveRepo } from '@/lib/daemon/repo'

export function useEvidenceHtml(enabled: boolean): UseQueryResult<Evidence | null, DaemonError> {
  const repo = useActiveRepo()
  const focused = useIsFocused()
  return useDaemonQuery(loopEvidenceHtmlQuery, repo?.path ?? '', {
    enabled: enabled && repo !== null && focused,
  })
}
