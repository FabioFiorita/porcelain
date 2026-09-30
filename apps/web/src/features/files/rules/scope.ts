export type FilesScope = { projectId: string; worktreeId: string };

export type FilesConnection = {
  controller: AbortController;
  environmentId: string;
  request: (signal?: AbortSignal) => { signal: AbortSignal };
  transport: (path: string, init?: RequestInit) => Promise<Response>;
};
