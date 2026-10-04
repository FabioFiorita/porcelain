import { useState } from 'react';
import { WorktreeEmpty } from '../../../shared/worktree-empty';
import type { HistoryWorkspace } from '../queries/history';
import { HistoryList } from './history-list';
import { CommitDetails, type CommitDiffRenderer } from './commit-details';

export function HistoryScreen({
  workspace,
  renderDiff,
}: {
  workspace?: HistoryWorkspace;
  renderDiff?: CommitDiffRenderer | undefined;
} = {}) {
  if (!workspace) return <WorktreeEmpty title="History" />;
  return (
    <WorktreeHistory
      key={JSON.stringify([
        workspace.connection.environmentId,
        workspace.connection.cacheIdentity,
        workspace.scope,
      ])}
      workspace={workspace}
      renderDiff={renderDiff}
    />
  );
}

function WorktreeHistory({
  workspace,
  renderDiff,
}: {
  workspace: HistoryWorkspace;
  renderDiff?: CommitDiffRenderer | undefined;
}) {
  const [oid, setOid] = useState<string>();
  return oid ? (
    <CommitDetails
      key={oid}
      workspace={workspace}
      oid={oid}
      onBack={() => setOid(undefined)}
      renderDiff={renderDiff}
    />
  ) : (
    <HistoryList workspace={workspace} onOpen={setOid} />
  );
}
