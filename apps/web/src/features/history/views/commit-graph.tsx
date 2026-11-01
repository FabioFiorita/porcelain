import { historyPlace } from '@porcelain/client/history';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { useHistory } from '../queries/history';
import type { HistoryScope } from '@porcelain/client/history/rules';
import { HistoryHeading, NoCommits } from './history-navigation';
import { GraphRows } from './history-rows';
import { type Connection } from '@/shared/workspace/connection';
import { useHistoryScroll } from '../adapters/history-scroll';

export function CommitGraph({
  scope,
  connection,
  onSelect,
  sideLabel,
}: {
  scope: HistoryScope;
  connection: Connection;
  onSelect: (oid: string, toSide?: boolean) => void;
  sideLabel: string;
}) {
  const history = useHistory(connection, scope);
  const phone = useIsMobile();
  const scroll = useHistoryScroll(
    historyPlace({ connection, scope, kind: 'commits' }),
    'graphScrollOffset',
  );

  return (
    <div
      className="@container/graph flex min-h-0 flex-1 flex-col overflow-auto"
      role="region"
      aria-label="Graph reading area"
      {...scroll}
    >
      <HistoryHeading history={history} />
      {history.commits.length === 0 ? (
        <NoCommits />
      ) : (
        <GraphRows
          label="Commit graph"
          highlightHead
          layout={phone ? 'stacked' : 'columns'}
          history={history}
          selected={history.selected ?? ''}
          onSelect={(oid, toSide) => {
            history.select(oid);
            onSelect(oid, toSide);
          }}
          sideLabel={sideLabel}
        />
      )}
    </div>
  );
}
