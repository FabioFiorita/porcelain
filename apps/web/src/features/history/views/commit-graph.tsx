import { HISTORY_GRAPH_ROW_GAP, HISTORY_ROW_HEIGHT } from '@/config/limits';
import { useHistory } from '../queries/history';
import type { HistoryScope } from '../rules/connection';
import { historyGraphWidth, layoutGraph } from '../rules/graph';
import { CommitRow } from './commit-row';
import { HistoryGraph } from './history-graph';
import { HistoryHeading, NoCommits } from './history-navigation';
import { HistoryEnd } from './history-rows';
import { type Connection } from '@/shared/workspace/connection';

export function CommitGraph({
  scope,
  connection,
  onSelect,
}: {
  scope: HistoryScope;
  connection: Connection;
  onSelect: (oid: string) => void;
}) {
  const history = useHistory(connection, scope);
  const rows = layoutGraph(history.commits);
  const width = historyGraphWidth(rows);

  return (
    <div className="flex flex-col">
      <HistoryHeading history={history} />
      {rows.length === 0 ? (
        <NoCommits />
      ) : (
        <div className="relative px-1.5 py-2">
          <HistoryGraph rows={rows} width={width} />
          <ol aria-label="Commit graph" className="flex flex-col">
            {rows.map(({ commit }) => (
              <li key={commit.oid}>
                <CommitRow
                  commit={commit}
                  selected={false}
                  height={HISTORY_ROW_HEIGHT}
                  inset={width + HISTORY_GRAPH_ROW_GAP}
                  onSelect={() => onSelect(commit.oid)}
                />
              </li>
            ))}
          </ol>
          <div style={{ paddingLeft: width }}>
            <HistoryEnd history={history} />
          </div>
        </div>
      )}
    </div>
  );
}
