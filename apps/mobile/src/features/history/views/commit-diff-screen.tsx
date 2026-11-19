import { useLocalSearchParams } from 'expo-router';
import { DocumentScreen } from '../../../components/ui/document-header';
import { Empty } from '../../../components/ui/empty';
import { WorkspaceGate } from '../../projects';
import { DiffContent } from './diff-content';

export function CommitDiffScreen() {
  const {
    oid,
    workspace,
    path,
    parent: requestedParent,
  } = useLocalSearchParams<{
    oid: string;
    workspace?: string;
    path: string;
    parent?: string;
  }>();
  const parent = Number(requestedParent ?? 1);
  const changed = <Empty title="Another worktree is selected now." />;
  return (
    <DocumentScreen path={path}>
      <WorkspaceGate expectedWorkspace={workspace} changed={changed}>
        {(current) =>
          Number.isInteger(parent) && parent > 0 ? (
            <DiffContent
              key={`${current.key}:${oid}:${parent}:${path}`}
              selection={current}
              oid={oid}
              parent={parent}
              path={path}
            />
          ) : (
            changed
          )
        }
      </WorkspaceGate>
    </DocumentScreen>
  );
}
