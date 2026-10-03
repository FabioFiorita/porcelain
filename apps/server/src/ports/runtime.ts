export type Runtime = {
  address: string;
  socketPath: string;
  close(): Promise<void>;
};
