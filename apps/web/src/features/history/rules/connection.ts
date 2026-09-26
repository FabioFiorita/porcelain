export type HistoryScope = { projectId: string; worktreeId: string };

export type HistoryConnection = {
  environmentId: string;
  request: (signal?: AbortSignal) => { signal: AbortSignal };
};
