export type FilesScope = { projectId: string; worktreeId: string };

export type FilesConnection = {
  environmentId: string;
  request: (signal?: AbortSignal) => { signal: AbortSignal };
};
