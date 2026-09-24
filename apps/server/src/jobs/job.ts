export type Job = {
  start(): void;
  stop(): void | Promise<void>;
};

export type JobOptions = { intervalMs: number };
