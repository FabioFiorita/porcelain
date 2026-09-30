export type ProjectConnection = {
  environmentId: string;
  controller: AbortController;
  request: (signal?: AbortSignal) => { signal: AbortSignal };
  transport: (path: string, init?: RequestInit) => Promise<Response>;
};
