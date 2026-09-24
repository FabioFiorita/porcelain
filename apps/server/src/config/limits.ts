import {
  COMMIT_GROUPS,
  COMMIT_MESSAGE_BYTES,
  DEVICE_LABEL_LENGTH,
  DEVICE_PLATFORM_LENGTH,
  DIRECTORY_ENTRIES,
  PATH_LENGTH,
  REVIEW_SUMMARY_BYTES,
  REVIEWED_FILE_MARKS,
  TEXT_BYTES,
  WORKTREE_ID_LENGTH,
} from '@porcelain/contracts/shared';

const SECOND_MS = 1000;
export const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const KIBIBYTE = 1024;
const MEBIBYTE = 1024 * KIBIBYTE;
const JSON_ESCAPE_FACTOR = 6;
const DEVICE_LIFETIME_MS = 90 * DAY_MS;

export type Limits = {
  access: {
    pairingGrant: { lifetimeMs: number };
    device: { unusedLifetimeMs: number; cookieMaxAgeSeconds: number };
    deviceDetails: { labelLength: number; platformLength: number };
    credentials: { secretBytes: number };
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
    worktreeIds: { length: number };
  };
  files: {
    readTextFile: { maxBytes: number };
    editFile: { maxCurrentBytes: number };
    readFileAsset: { maxBytes: number; base64ChunkBytes: number };
    readPreviewAssets: {
      maxAssetBytes: number;
      maxTotalBytes: number;
      maxPathLength: number;
      base64ChunkBytes: number;
    };
    listDirectory: { maxEntries: number; maxResponseBytes: number };
    permissions: { fileMode: number; directoryMode: number };
  };
  changes: {
    changeLines: { maxLines: number };
    fingerprints: { maxDigestBytes: number };
    worktreeReads: { chunkBytes: number; concurrency: number };
  };
  reviews: {
    comments: {
      threadsPerWorktree: number;
      messagesPerThread: number;
      bytesPerWorktree: number;
    };
    reviewedFiles: { marksPerWorktree: number };
    summaryLink: { lifetimeMs: number; secretBytes: number };
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
  http: { reviewBodyBytes: number; editFileBodyBytes: number };
  owner: {
    requestTimeoutMs: number;
    probeTimeoutMs: number;
    quickProbeTimeoutMs: number;
    mcpTimeoutMs: number;
    socketPathBytes: number;
  };
};

export const LIMITS: Limits = {
  access: {
    pairingGrant: { lifetimeMs: 15 * MINUTE_MS },
    device: {
      unusedLifetimeMs: DEVICE_LIFETIME_MS,
      cookieMaxAgeSeconds: DEVICE_LIFETIME_MS / SECOND_MS,
    },
    deviceDetails: {
      labelLength: DEVICE_LABEL_LENGTH,
      platformLength: DEVICE_PLATFORM_LENGTH,
    },
    credentials: { secretBytes: 32 },
    pairingAttempts: {
      windowMs: MINUTE_MS,
      attemptsPerPeer: 10,
      attemptsOverall: 60,
      maxPeers: 1024,
    },
  },
  projects: {
    presence: { graceMs: 30 * DAY_MS },
    folders: { maxEntries: DIRECTORY_ENTRIES },
    discovery: {
      maxRepositories: 50,
      maxFolders: 500,
      maxDepth: 3,
      maxEntries: 2000,
      skippedNames: ['node_modules', 'vendor', 'dist', 'build', 'target'],
    },
    filePreferences: { maxPreferences: 2000 },
    worktreeIds: { length: WORKTREE_ID_LENGTH },
  },
  files: {
    readTextFile: { maxBytes: TEXT_BYTES },
    editFile: { maxCurrentBytes: TEXT_BYTES },
    readFileAsset: { maxBytes: 10 * MEBIBYTE, base64ChunkBytes: 32 * KIBIBYTE },
    readPreviewAssets: {
      maxAssetBytes: 10 * MEBIBYTE,
      maxTotalBytes: 16 * MEBIBYTE,
      maxPathLength: PATH_LENGTH,
      base64ChunkBytes: 32 * KIBIBYTE,
    },
    listDirectory: {
      maxEntries: DIRECTORY_ENTRIES,
      maxResponseBytes: MEBIBYTE,
    },
    permissions: { fileMode: 0o644, directoryMode: 0o700 },
  },
  changes: {
    changeLines: { maxLines: 2000 },
    fingerprints: { maxDigestBytes: 64 * MEBIBYTE },
    worktreeReads: { chunkBytes: MEBIBYTE, concurrency: 8 },
  },
  reviews: {
    comments: {
      threadsPerWorktree: 100,
      messagesPerThread: 100,
      bytesPerWorktree: MEBIBYTE,
    },
    reviewedFiles: { marksPerWorktree: REVIEWED_FILE_MARKS },
    summaryLink: { lifetimeMs: HOUR_MS, secretBytes: 32 },
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
    commitGroups: {
      maxGroups: COMMIT_GROUPS,
      maxMessageBytes: COMMIT_MESSAGE_BYTES,
    },
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
  http: {
    reviewBodyBytes: JSON_ESCAPE_FACTOR * REVIEW_SUMMARY_BYTES + MEBIBYTE,
    editFileBodyBytes: 8 * MEBIBYTE,
  },
  owner: {
    requestTimeoutMs: 10 * SECOND_MS,
    probeTimeoutMs: 5 * SECOND_MS,
    quickProbeTimeoutMs: 500,
    mcpTimeoutMs: 2 * MINUTE_MS,
    socketPathBytes: 103,
  },
};
