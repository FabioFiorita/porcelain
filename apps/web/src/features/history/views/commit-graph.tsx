import { useIsMobile } from '@/shared/hooks/use-mobile';
import { useHistory } from '../queries/history';
import type { HistoryScope } from '@porcelain/client/history/rules';
import { HistoryHeading, NoCommits } from './history-navigation';
import { GraphRows } from './history-rows';
import { type Connection } from '@/shared/workspace/connection';

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

  return (
    <div className="@container/graph flex flex-col">
      <HistoryHeading history={history} />
      {history.commits.length === 0 ? (
        <NoCommits />
      ) : (
        <GraphRows
          label="Commit graph"
          layout={phone ? 'stacked' : 'columns'}
          history={history}
          selected=""
          onSelect={onSelect}
          sideLabel={sideLabel}
        />
      )}
    </div>
  );
}
