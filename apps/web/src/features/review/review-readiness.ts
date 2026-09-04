import type { ReviewReadinessInput, ReviewReadinessOutput } from '@porcelain/contracts/review'
import { hubOwnerClient, useHubRepoOwner } from '@renderer/hooks/use-hub-owner'
import { useQuery } from '@tanstack/react-query'

type ReviewReadinessIdentity = Readonly<{
  domain: 'review'
  name: 'readiness'
  repoPath: string
  scope: ReviewReadinessInput['scope']
}>

export function reviewReadinessIdentity(
  repoPath: string,
  scope: ReviewReadinessInput['scope'],
): ReviewReadinessIdentity {
  return { domain: 'review', name: 'readiness', repoPath, scope }
}

/** Daemon-observed Review status for the selected Changes/History scope. */
export function useReviewReadiness(scope: ReviewReadinessInput['scope']): {
  readiness: ReviewReadinessOutput | undefined
  error: Error | null
} {
  const { repoPath, daemon, owner } = useHubRepoOwner()
  const path = repoPath ?? '/__porcelain-disabled-review-readiness__'
  const live = scope.type !== 'commit'
  const query = useQuery({
    enabled: repoPath !== null && owner !== null,
    queryFn: () => hubOwnerClient(owner).reviewReadiness.query({ repoPath: path, scope }),
    queryKey: [reviewReadinessIdentity(path, scope), daemon] as const,
    refetchInterval: live ? 3000 : false,
    staleTime: live ? 0 : Number.POSITIVE_INFINITY,
  })
  return { readiness: query.data, error: query.error }
}
