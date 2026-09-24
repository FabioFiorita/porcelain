const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const KIBIBYTE = 1024;
const MEBIBYTE = 1024 * KIBIBYTE;

export type Limits = {
  access: {
    pairingGrant: { lifetimeMs: number };
    device: { unusedLifetimeMs: number };
    pairingAttempts: {
      windowMs: number;
      attemptsPerPeer: number;
      attemptsOverall: number;
      maxPeers: number;
    };
  };
  projects: {
    presence: { graceMs: number };
    folders: { maxEntries: number };
    discovery: {
      maxRepositories: number;
      maxFolders: number;
      maxDepth: number;
      maxEntries: number;
      skippedNames: readonly string[];
    };
    filePreferences: { maxPreferences: number };
  };
  files: {
    readTextFile: { maxBytes: number };
    editFile: { maxCurrentBytes: number };
    readFileAsset: { maxBytes: number };
    readPreviewAssets: {
      maxAssetBytes: number;
      maxTotalBytes: number;
      maxPathLength: number;
    };
    listDirectory: { maxEntries: number; maxResponseBytes: number };
  };
  changes: {
    changeLines: { maxLines: number };
    fingerprints: { maxDigestBytes: number };
  };
  reviews: {
    comments: {
      threadsPerWorktree: number;
      messagesPerThread: number;
      bytesPerWorktree: number;
    };
    reviewedFiles: { marksPerWorktree: number };
    summaryLink: { lifetimeMs: number };
  };
  gitActions: {
    deadlineMs: number;
    commitModelDeadlineMs: number;
    receipts: { retentionMs: number };
    progress: { progressLines: number };
    commitDraft: {
      maxComparisons: number;
      maxEvidenceBytes: number;
      maxUntrackedBytes: number;
    };
    commitGroups: { maxGroups: number; maxMessageBytes: number };
  };
  inventory: { listingLaunches: number; listingTimeoutMs: number };
  lanes: { readCapacity: number; operationTimeoutMs: number };
  liveUpdates: {
    maxConnections: number;
    maxWatchedWorktrees: number;
    burstMs: number;
    heartbeatMs: number;
    pingMs: number;
    messageBytes: number;
  };
  jobs: {
    refreshInventoryMs: number;
    collectAbsentWorktreesMs: number;
    flushDeviceActivityMs: number;
  };
};

export const LIMITS: Limits = {
  access: {
    pairingGrant: { lifetimeMs: 15 * MINUTE_MS },
    device: { unusedLifetimeMs: 90 * DAY_MS },
    pairingAttempts: {
      windowMs: MINUTE_MS,
      attemptsPerPeer: 10,
      attemptsOverall: 60,
      maxPeers: 1024,
    },
  },
  projects: {
    presence: { graceMs: 30 * DAY_MS },
    folders: { maxEntries: 2000 },
    discovery: {
      maxRepositories: 50,
      maxFolders: 500,
      maxDepth: 3,
      maxEntries: 2000,
      skippedNames: ['node_modules', 'vendor', 'dist', 'build', 'target'],
    },
    filePreferences: { maxPreferences: 2000 },
  },
  files: {
    readTextFile: { maxBytes: MEBIBYTE },
    editFile: { maxCurrentBytes: MEBIBYTE },
    readFileAsset: { maxBytes: 10 * MEBIBYTE },
    readPreviewAssets: {
      maxAssetBytes: 10 * MEBIBYTE,
      maxTotalBytes: 16 * MEBIBYTE,
      maxPathLength: 4096,
    },
    listDirectory: { maxEntries: 2000, maxResponseBytes: MEBIBYTE },
  },
  changes: {
    changeLines: { maxLines: 2000 },
    fingerprints: { maxDigestBytes: 64 * MEBIBYTE },
  },
  reviews: {
    comments: {
      threadsPerWorktree: 100,
      messagesPerThread: 100,
      bytesPerWorktree: MEBIBYTE,
    },
    reviewedFiles: { marksPerWorktree: 2000 },
    summaryLink: { lifetimeMs: HOUR_MS },
  },
  gitActions: {
    deadlineMs: 2 * MINUTE_MS,
    commitModelDeadlineMs: 2 * MINUTE_MS,
    receipts: { retentionMs: 30 * DAY_MS },
    progress: { progressLines: 200 },
    commitDraft: {
      maxComparisons: 200,
      maxEvidenceBytes: MEBIBYTE,
      maxUntrackedBytes: MEBIBYTE,
    },
    commitGroups: { maxGroups: 20, maxMessageBytes: 16 * KIBIBYTE },
  },
  inventory: { listingLaunches: 4, listingTimeoutMs: 5 * SECOND_MS },
  lanes: { readCapacity: 4, operationTimeoutMs: 30 * SECOND_MS },
  liveUpdates: {
    maxConnections: 64,
    maxWatchedWorktrees: 64,
    burstMs: 150,
    heartbeatMs: 25 * SECOND_MS,
    pingMs: 30 * SECOND_MS,
    messageBytes: 64 * KIBIBYTE,
  },
  jobs: {
    refreshInventoryMs: 30 * SECOND_MS,
    collectAbsentWorktreesMs: HOUR_MS,
    flushDeviceActivityMs: MINUTE_MS,
  },
};
