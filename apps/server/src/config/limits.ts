const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const KIBIBYTE = 1024;
const MEBIBYTE = 1024 * KIBIBYTE;

export type Limits = {
  directory: { maxEntries: number; maxResponseBytes: number };
  comments: {
    threadsPerWorktree: number;
    messagesPerThread: number;
    bytesPerWorktree: number;
  };
  presence: { graceMs: number };
  receipts: { retentionMs: number };
  inventory: { listingLaunches: number; listingTimeoutMs: number };
  lanes: { readCapacity: number; operationTimeoutMs: number };
  gitActions: { deadlineMs: number; commitModelDeadlineMs: number };
  liveUpdates: {
    maxConnections: number;
    maxWatchedWorktrees: number;
    burstMs: number;
    heartbeatMs: number;
    pingMs: number;
    messageBytes: number;
  };
  jobs: { collectAbsentWorktreesMs: number; flushDeviceActivityMs: number };
};

export const LIMITS: Limits = {
  directory: { maxEntries: 2000, maxResponseBytes: MEBIBYTE },
  comments: {
    threadsPerWorktree: 100,
    messagesPerThread: 100,
    bytesPerWorktree: MEBIBYTE,
  },
  presence: { graceMs: 30 * DAY_MS },
  receipts: { retentionMs: 30 * DAY_MS },
  inventory: { listingLaunches: 4, listingTimeoutMs: 5 * SECOND_MS },
  lanes: { readCapacity: 4, operationTimeoutMs: 30 * SECOND_MS },
  gitActions: {
    deadlineMs: 2 * MINUTE_MS,
    commitModelDeadlineMs: 2 * MINUTE_MS,
  },
  liveUpdates: {
    maxConnections: 64,
    maxWatchedWorktrees: 64,
    burstMs: 150,
    heartbeatMs: 25 * SECOND_MS,
    pingMs: 30 * SECOND_MS,
    messageBytes: 64 * KIBIBYTE,
  },
  jobs: { collectAbsentWorktreesMs: HOUR_MS, flushDeviceActivityMs: MINUTE_MS },
};
