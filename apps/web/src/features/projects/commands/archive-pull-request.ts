import { useAtom } from '@effect/atom-react';
import { useNavigate } from '@tanstack/react-router';
import { archivePullRequest } from '@porcelain/client/projects';
import { refreshInventory } from '@porcelain/client/projects';
import type { Connection as RuntimeConnection } from '@/shared/workspace/connection';
import type { ArchivePullRequestRequest } from '@porcelain/contracts/projects';
export function useArchivePullRequest(
  connection: RuntimeConnection,
  projectId: string,
  number: number,
  onArchived?: () => void,
  beforeLeave?: () => void,
) {
  const [result, run] = useAtom(
    archivePullRequest({ connection, projectId, number }),
    { mode: 'promise' },
  );
  const [, refresh] = useAtom(refreshInventory(connection), {
    mode: 'promise',
  });
  const navigate = useNavigate();
  return {
    result,
    submit: async (payload: ArchivePullRequestRequest) => {
      if (payload.confirmation && beforeLeave) beforeLeave();
      let answer;
      try {
        answer = await run(payload);
        if (answer.archived) {
          await refresh();
          await navigate({ to: '/', replace: true });
        }
      } catch {
        return undefined;
      }
      if (answer.archived && onArchived) onArchived();
      return answer;
    },
  };
}
