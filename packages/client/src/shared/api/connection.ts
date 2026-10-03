import type { Transport } from './transport.ts';

export type WorktreeConnection = {
  environmentId: string;
  transport: Transport;
  request: (signal?: AbortSignal) => { signal: AbortSignal };
  cacheIdentity?: readonly string[];
};

export type WorktreeScope = { projectId: string; worktreeId: string };
