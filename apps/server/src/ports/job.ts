export type Job = {
  start(): void;
  stop(): Promise<void>;
};
