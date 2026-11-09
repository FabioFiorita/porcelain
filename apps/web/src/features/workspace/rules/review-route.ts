import { entryKey, type DocumentRef } from './documents';
import { WORKSPACE_SEARCH_VALUE_MAX_LENGTH } from '@/config/limits';
import * as Schema from 'effect/Schema';

const isSearchValue = Schema.is(
  Schema.String.check(Schema.isMaxLength(WORKSPACE_SEARCH_VALUE_MAX_LENGTH)),
);

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
  side?: string | undefined;
  decision: string | undefined;
  environment: string | undefined;
} {
  return {
    entry: isSearchValue(search.entry) ? search.entry : undefined,
    side: isSearchValue(search.side) ? search.side : undefined,
    decision: typeof search.decision === 'string' ? search.decision : undefined,
    environment:
      typeof search.environment === 'string' ? search.environment : undefined,
  };
}
