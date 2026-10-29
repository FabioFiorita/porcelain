import { useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { useState } from 'react';
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
  const read = Option.getOrUndefined(AsyncResult.value(result));
  const [held, setHeld] = useState<{ token: string; page: string }>();
  if (
    read !== undefined &&
    (held?.token !== summary.token || held.page !== read)
  )
    setHeld({ token: summary.token, page: read });
  const page = read ?? (held?.token === summary.token ? held.page : undefined);
  return {
    result,
    page,
    url,
    available: page !== undefined && hasAgentSummary(page),
  };
}
