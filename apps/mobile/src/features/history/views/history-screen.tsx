import { useState } from 'react';
import { useSelectedWorktree } from '../../projects';
import { WorktreeEmpty } from '../../../shared/worktree-empty';
import type { HistoryWorkspace } from '../queries/history';
import { HistoryList } from './history-list';
import { CommitDetails, type CommitDiffRenderer } from './commit-details';

export function HistoryScreen({
  renderDiff,
}: {
  renderDiff?: CommitDiffRenderer | undefined;
} = {}) {
  const workspace = useSelectedWorktree();
  if (!workspace) return <WorktreeEmpty title="History" />;
  return (
    <WorktreeHistory
      key={workspace.key}
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
