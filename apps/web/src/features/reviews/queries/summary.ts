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

export function useReviewSummary(
  scope: ReviewScope,
  context: ConnectionContext,
  summary: ReviewResponse['summary'],
  active: boolean,
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
      enabled: active && !expired && summary.hasContent !== false,
      delivery: { url, transport: summaryTransport },
    }),
  );
  const page = Option.getOrUndefined(AsyncResult.value(result));
  return {
    page,
    url,
    loading:
      active && !expired && (AsyncResult.isInitial(result) || result.waiting),
    available: summary.hasContent !== false,
  };
}
