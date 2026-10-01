import type { Connection } from '@/shared/workspace/connection';
import { gitActionsApi } from '../api';

export function readGitReceipt(
  connection: Connection,
  request: {
    projectId: string;
    worktreeId: string;
    requestId: string;
    signal: AbortSignal;
  },
) {
  return gitActionsApi(connection).receipt(request);
}
