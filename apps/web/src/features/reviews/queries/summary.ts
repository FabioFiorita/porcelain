import { useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { readReviewSummary } from '@porcelain/client/reviews';
import {
  reviewSummaryUrl,
  type ReviewResponse,
  type ReviewScope,
} from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { desktopAppAddress } from '@/shared/adapters/desktop';
import { summaryTransport } from '@/shared/api/summary-transport';
import { hasAgentSummary } from '../adapters/summary-content';

export function useReviewSummary(
  scope: ReviewScope,
  context: ConnectionContext,
  summary: ReviewResponse['summary'],
) {
  const url = reviewSummaryUrl(
    summary,
    context.connection.address,
    desktopAppAddress(),
  );
  const expired = Date.parse(summary.expires) <= Date.now();
  const result = useAtomValue(
    readReviewSummary({
      connection: context.connection,
      scope,
      summary,
      enabled: !expired,
      delivery: { url, transport: summaryTransport },
    }),
  );
  const page = Option.getOrUndefined(AsyncResult.value(result));
  return {
    page,
    url,
    loading: !expired && (AsyncResult.isInitial(result) || result.waiting),
    available: page === undefined ? expired : hasAgentSummary(page),
  };
}
