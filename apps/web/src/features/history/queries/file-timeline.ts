import {
  readFileTimeline,
  readFileTimelineWindow,
} from '@porcelain/client/history';
import { useAtomSet } from '@effect/atom-react';
import { useConfirmedRead } from '@/shared/query/confirmed-read';
import type { HistoryScope } from '@porcelain/client/history/rules';
import type { Connection } from '@/shared/workspace/connection';

export function useFileTimeline(
  connection: Connection,
  scope: HistoryScope,
  path: string,
) {
  const selection = { connection, scope, path };
  const { value, result } = useConfirmedRead(readFileTimelineWindow(selection));
  const readMore = useAtomSet(readFileTimeline(selection));
  return { ...value, result, readMore: () => readMore(undefined) };
}
