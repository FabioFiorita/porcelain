export type Job = {
  start(): void;
  stop(): void;
};

export type JobOptions = { intervalMs: number };
