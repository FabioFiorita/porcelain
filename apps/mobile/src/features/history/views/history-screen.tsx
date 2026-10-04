import { useState } from 'react';
import { useSelectedWorktree } from '../../projects';
import { WorktreeEmpty } from '../../../shared/worktree-empty';
import type { useHistory } from '../queries/history';
import { HistoryList } from './history-list';
import { CommitDetails } from './commit-details';

type HistoryWorkspace = Parameters<typeof useHistory>[0];

export function HistoryScreen() {
  const workspace = useSelectedWorktree();
  if (!workspace) return <WorktreeEmpty title="History" />;
  return <WorktreeHistory key={workspace.key} workspace={workspace} />;
}

function WorktreeHistory({ workspace }: { workspace: HistoryWorkspace }) {
  const [oid, setOid] = useState<string>();
  return oid ? (
    <CommitDetails
      key={oid}
      workspace={workspace}
      oid={oid}
      onBack={() => setOid(undefined)}
    />
  ) : (
    <HistoryList workspace={workspace} onOpen={setOid} />
  );
}
