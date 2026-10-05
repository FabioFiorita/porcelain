import { fileTimelineQueryOptions } from '@porcelain/client/history';
import { useSuspenseQuery } from '@tanstack/react-query';
import type { HistoryScope } from '@porcelain/client/history/rules';
import type { Connection } from '@/shared/workspace/connection';

export function useFileTimeline(
  connection: Connection,
  scope: HistoryScope,
  path: string,
) {
  return useSuspenseQuery(fileTimelineQueryOptions(scope, path, connection))
    .data;
}
