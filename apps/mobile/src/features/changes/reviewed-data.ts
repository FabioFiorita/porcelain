import { reviewMutations } from '@porcelain/client-runtime/review'
import type { ReviewedScope } from '@porcelain/contracts/review'
import { reviewProcedures } from '@porcelain/contracts/review'
import { useMemo } from 'react'
import { useHubRepoPath } from '@/features/projects'
import { useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'
import { namedContractMutation, namedContractQuery } from '@/lib/daemon/procedure'

const reviewedPathsProcedure = namedContractQuery('reviewedPaths', reviewProcedures.reviewedPaths)
const setReviewedProcedure = namedContractMutation(
  reviewMutations.setReviewed.procedureName,
  reviewMutations.setReviewed.procedure,
)

export function useReviewed(
  scope: ReviewedScope,
  active: boolean,
): {
  paths: ReadonlySet<string>
  onToggle: (path: string, reviewed: boolean) => void
} {
  const repoPath = useHubRepoPath()
  const input = scope.type === 'working' ? (repoPath ?? '') : { repoPath: repoPath ?? '', scope }
  const query = useDaemonQuery(reviewedPathsProcedure, input, {
    enabled: active && repoPath !== null,
    pollMs: 3000,
  })
  const mutation = useDaemonMutation(setReviewedProcedure, { invalidates: ['reviewedPaths'] })
  const paths = useMemo(() => new Set(query.data ?? []), [query.data])
  return {
    paths,
    onToggle: (path, reviewed) => {
      if (repoPath !== null)
        mutation.mutate({
          paths: [path],
          repoPath,
          reviewed,
          ...(scope.type === 'branch' ? { scope } : {}),
        })
    },
  }
}
