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
  const result = useAtomValue(
    readReviewSummary({
      connection: context.connection,
      scope,
      summary,
      delivery: { url, transport: summaryTransport },
    }),
  );
  const page = Option.getOrUndefined(AsyncResult.value(result));
  return {
    result,
    url,
    available: page !== undefined && hasAgentSummary(page),
  };
}
