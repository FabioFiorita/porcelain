export type ClosableListener = {
  close(): PromiseLike<unknown>;
  server: { closeAllConnections(): void };
};

export type NetworkListener = ClosableListener & {
  listen(options: { host: string; port: number }): Promise<string>;
};

export type SocketListener = ClosableListener & {
  listen(options: { path: string }): Promise<string>;
};
