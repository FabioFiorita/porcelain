import {
  useConnectedContext,
  useRemoteConnections,
} from '@/features/access/index';
import { ProjectHistory } from '@/features/reviews/index';
import { ConnectedWorkspace } from './connected-workspace';
export function ProjectHistoryRoute({
  projectId,
  environment,
}: {
  projectId: string;
  environment?: string;
}) {
  const remotes = useRemoteConnections();
  const remote = remotes.find(
    (entry) => entry.remote.environmentId === environment,
  );
  const context = useConnectedContext(remote?.connection);
  return (
    <ConnectedWorkspace {...(remote ? { remote } : {})}>
      {() =>
        environment && environment !== context.connection.environmentId ? (
          <p>
            Computer not paired. Open this project from its connected computer.
          </p>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <ProjectHistory projectId={projectId} context={context} />
          </div>
        )
      }
    </ConnectedWorkspace>
  );
}
