import { entryKey, type DocumentRef } from './documents';

export function pullRequestReviewDestination(
  source: Extract<DocumentRef, { kind: 'pull-request' }>,
  localEnvironmentId: string,
  entry: { kind: 'handoff' } | { kind: 'file'; path: string },
) {
  return {
    to: '/reviews/$reviewId' as const,
    params: { reviewId: source.reviewId },
    search: {
      environment:
        source.environmentId === localEnvironmentId
          ? undefined
          : source.environmentId,
      entry: entryKey(entry),
      decision: undefined,
    },
  };
}

export function reviewRouteSearch(search: Record<string, unknown>): {
  entry?: string | undefined;
  decision: string | undefined;
  environment: string | undefined;
} {
  return {
    entry: typeof search.entry === 'string' ? search.entry : undefined,
    decision: typeof search.decision === 'string' ? search.decision : undefined,
    environment:
      typeof search.environment === 'string' ? search.environment : undefined,
  };
}
