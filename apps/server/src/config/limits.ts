import {
  BRANCH_BASES,
  CHANGED_PATHS,
  COMMENT_THREADS_PER_WORKTREE,
  COMMIT_FILES,
  COMMIT_GROUPS,
  COMMITS_PER_PAGE,
  DISCARDED_CHANGES,
  HISTORY_FRONTIER,
  COMMIT_MESSAGE_BYTES,
  DEVICE_LABEL_LENGTH,
  DEVICE_PLATFORM_LENGTH,
  DIRECTORY_ENTRIES,
  ENVIRONMENT_PROTOCOL,
  PATH_LENGTH,
  TUNNEL_HOSTNAME_LENGTH,
  REVIEW_PROOF_BYTES,
  REVIEW_PROOF_FILE_BYTES,
  REVIEW_SUMMARY_BYTES,
  REVIEWED_BRANCH_FILE_MARKS,
  REVIEWED_FILE_MARKS,
  TEXT_BYTES,
  WORKTREE_ID_LENGTH,
  WORKTREE_PATHS,
} from '@porcelain/contracts/shared';

const SECOND_MS = 1000;
export const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const YEAR_MS = 365 * DAY_MS;
const KIBIBYTE = 1024;
const MEBIBYTE = 1024 * KIBIBYTE;
const JSON_ESCAPE_FACTOR = 6;
const FILE_ASSET_BYTES = 10 * MEBIBYTE;
const DEVICE_LIFETIME_MS = 90 * DAY_MS;
const PROCESS_GROUP = { lingerMs: 250, cleanupMs: 5 * SECOND_MS, pollMs: 10 };

type ProcessGroupLimits = typeof PROCESS_GROUP;

export type Limits = {
  desktop: {
    startupMs: number;
    shutdownMs: number;
    windowWidth: number;
    windowHeight: number;
    minWidth: number;
    minHeight: number;
    windowStateSaveMs: number;
    serverLogBytes: number;
  };
  access: {
    environment: { protocol: number };
    pairingGrant: { lifetimeMs: number };
    liveTicket: {
      lifetimeMs: number;
      maxOutstanding: number;
      maxPerDevice: number;
    };
    device: { unusedLifetimeMs: number; cookieMaxAgeSeconds: number };
    deviceDetails: { labelLength: number; platformLength: number };
    credentials: { secretBytes: number };
    serviceUpdate: { latestVersionTtlMs: number };
    remoteAccess: {
      hostnameLength: number;
      probeTimeoutMs: number;
      strictTransportMaxAgeSeconds: number;
    };
    networkDiscovery: {
      commandTimeoutMs: number;
      outputBytes: number;
      processGroup: ProcessGroupLimits;
    };
    pairingAttempts: {
      windowMs: number;
      attemptsPerPeer: number;
      attemptsOverall: number;
      maxPeers: number;
    };
    crossOriginPairingAttempts: {
      windowMs: number;
      attemptsPerPeer: number;
      attemptsOverall: number;
      maxPeers: number;
    };
  };
  projects: {
    presence: { graceMs: number };
    folders: { maxEntries: number };
    filePreferences: { maxPreferences: number };
    worktreeIds: { length: number };
  };
  files: {
    readTextFile: { maxBytes: number };
    editFile: { maxCurrentBytes: number; maxCopyBytes: number };
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
    status: { maxChanges: number };
    changeLines: { maxLines: number };
    fingerprints: { maxDigestBytes: number; maxPathLength: number };
    worktreeReads: { chunkBytes: number; concurrency: number };
  };
  reviews: {
    comments: {
      threadsPerWorktree: number;
      messagesPerThread: number;
      bytesPerWorktree: number;
    };
    reviewedFiles: { marksPerWorktree: number; marksPerBranch: number };
    summaryLink: { lifetimeMs: number; secretBytes: number };
    proof: {
      maxBytes: number;
      totalBytes: number;
      signatureBytes: number;
      base64ChunkBytes: number;
    };
  };
  gitActions: {
    deadlineMs: number;
    processDeadlineMs: number;
    receipts: { retentionMs: number };
    progress: { progressLines: number };
    commitDraft: {
      maxComparisons: number;
      maxEvidenceBytes: number;
      maxUntrackedBytes: number;
    };
    commitGroups: { maxGroups: number; maxMessageBytes: number };
  };
  git: {
    processGroup: ProcessGroupLimits;
    readTimeoutMs: number;
    outputBytes: number;
    followUpTimeoutMs: number;
    renames: { limit: number; similarityPercent: number };
    inspection: {
      statusBytes: number;
      maxChanges: number;
      maxPathLength: number;
      diffBatchBytes: number;
      patchBytes: number;
      selectedDiffBytes: number;
      upstreamOidBytes: number;
      ignoredPathsBytes: number;
      checkIgnoredBytes: number;
      checkoutDirectoryBytes: number;
      stashListBytes: number;
      maxStashes: number;
      contextLines: number;
      submoduleStatusBytes: number;
      filterConfigBytes: number;
      filterPathsBytes: number;
      filterAttributesBytes: number;
      trackedPathsBytes: number;
      maxTrackedPaths: number;
      headCommitBytes: number;
      branchTrackingBytes: number;
      discardedRefsBytes: number;
      discardedBlobsBytes: number;
      maxDiscarded: number;
    };
    history: {
      defaultCommits: number;
      maxCommits: number;
      maxFrontier: number;
      maxCommitFiles: number;
      maxBranchBases: number;
      subjectBytes: number;
      bodyBytes: number;
    };
    actions: { maxCommitPaths: number; hookBytes: number; maxNewFiles: number };
  };
  inventory: {
    listingLaunches: number;
    listingTimeoutMs: number;
    staleAfterMs: number;
  };
  lanes: { readCapacity: number; operationTimeoutMs: number };
  storage: { busyTimeoutMs: number };
  liveUpdates: {
    maxConnections: number;
    maxWatchedWorktrees: number;
    burstMs: number;
    announcedEditMs: number;
    heartbeatMs: number;
    pingMs: number;
    messageBytes: number;
  };
  jobs: {
    refreshInventoryMs: number;
    collectAbsentWorktreesMs: number;
    flushDeviceActivityMs: number;
    openRemoteRoutesMs: number;
  };
  http: {
    reviewBodyBytes: number;
    editFileBodyBytes: number;
    corsMaxAgeSeconds: number;
  };
  locks: { startupWaitMs: number; pollMs: number; staleTakeovers: number };
  installer: {
    command: {
      timeoutMs: number;
      maxBytes: number;
      processGroup: ProcessGroupLimits;
    };
    health: { attempts: number; intervalMs: number };
  };
  listeners: { closeGraceMs: number };
  cli: {
    printedAddressLength: number;
    printedIdLength: number;
    shareSettleMs: number;
    sharePollMs: number;
  };
  agents: {
    processGroup: ProcessGroupLimits;
    processDeadlineMs: number;
    claudeOutputBytes: number;
    codexOutputBytes: number;
    codexCacheBytes: number;
    plan: {
      maxGroups: number;
      maxMessageLength: number;
      maxPathLength: number;
      maxPaths: number;
    };
  };
  network: {
    defaultPort: number;
    maxPort: number;
    maxHostnameLength: number;
    ipv4Octets: number;
  };
  owner: {
    requestTimeoutMs: number;
    probeTimeoutMs: number;
    quickProbeTimeoutMs: number;
    mcpTimeoutMs: number;
    socketPathBytes: number;
  };
};

export const LIMITS: Limits = {
  desktop: {
    startupMs: 20 * SECOND_MS,
    shutdownMs: 10 * SECOND_MS,
    windowWidth: 1280,
    windowHeight: 840,
    minWidth: 800,
    minHeight: 600,
    windowStateSaveMs: 500,
    serverLogBytes: 5 * MEBIBYTE,
  },
  access: {
    environment: { protocol: ENVIRONMENT_PROTOCOL },
    pairingGrant: { lifetimeMs: 15 * MINUTE_MS },
    liveTicket: {
      lifetimeMs: 30 * SECOND_MS,
      maxOutstanding: 256,
      maxPerDevice: 4,
    },
    device: {
      unusedLifetimeMs: DEVICE_LIFETIME_MS,
      cookieMaxAgeSeconds: DEVICE_LIFETIME_MS / SECOND_MS,
    },
    deviceDetails: {
      labelLength: DEVICE_LABEL_LENGTH,
      platformLength: DEVICE_PLATFORM_LENGTH,
    },
    credentials: { secretBytes: 32 },
    serviceUpdate: { latestVersionTtlMs: 10 * MINUTE_MS },
    remoteAccess: {
      hostnameLength: TUNNEL_HOSTNAME_LENGTH,
      probeTimeoutMs: 5 * SECOND_MS,
      strictTransportMaxAgeSeconds: YEAR_MS / SECOND_MS,
    },
    networkDiscovery: {
      commandTimeoutMs: SECOND_MS,
      outputBytes: KIBIBYTE,
      processGroup: PROCESS_GROUP,
    },
    pairingAttempts: {
      windowMs: MINUTE_MS,
      attemptsPerPeer: 10,
      attemptsOverall: 60,
      maxPeers: 1024,
    },
    crossOriginPairingAttempts: {
      windowMs: MINUTE_MS,
      attemptsPerPeer: 10,
      attemptsOverall: 30,
      maxPeers: 1024,
    },
  },
  projects: {
    presence: { graceMs: 30 * DAY_MS },
    folders: { maxEntries: DIRECTORY_ENTRIES },
    filePreferences: { maxPreferences: 2000 },
    worktreeIds: { length: WORKTREE_ID_LENGTH },
  },
  files: {
    readTextFile: { maxBytes: TEXT_BYTES },
    editFile: { maxCurrentBytes: TEXT_BYTES, maxCopyBytes: FILE_ASSET_BYTES },
    readFileAsset: {
      maxBytes: FILE_ASSET_BYTES,
      base64ChunkBytes: 32 * KIBIBYTE,
    },
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
    status: { maxChanges: CHANGED_PATHS },
    changeLines: { maxLines: 2000 },
    fingerprints: { maxDigestBytes: 64 * MEBIBYTE, maxPathLength: PATH_LENGTH },
    worktreeReads: { chunkBytes: MEBIBYTE, concurrency: 8 },
  },
  reviews: {
    comments: {
      threadsPerWorktree: COMMENT_THREADS_PER_WORKTREE,
      messagesPerThread: 100,
      bytesPerWorktree: MEBIBYTE,
    },
    reviewedFiles: {
      marksPerWorktree: REVIEWED_FILE_MARKS,
      marksPerBranch: REVIEWED_BRANCH_FILE_MARKS,
    },
    summaryLink: { lifetimeMs: HOUR_MS, secretBytes: 32 },
    proof: {
      maxBytes: REVIEW_PROOF_FILE_BYTES,
      totalBytes: REVIEW_PROOF_BYTES,
      signatureBytes: 16,
      base64ChunkBytes: 32 * KIBIBYTE,
    },
  },
  gitActions: {
    deadlineMs: 2 * MINUTE_MS,
    processDeadlineMs: 2 * MINUTE_MS,
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
  git: {
    processGroup: PROCESS_GROUP,
    readTimeoutMs: 10 * SECOND_MS,
    outputBytes: 4 * MEBIBYTE,
    followUpTimeoutMs: 5 * SECOND_MS,
    renames: { limit: 2000, similarityPercent: 50 },
    inspection: {
      statusBytes: 8 * MEBIBYTE,
      maxChanges: CHANGED_PATHS,
      maxPathLength: PATH_LENGTH,
      diffBatchBytes: 32 * MEBIBYTE,
      patchBytes: MEBIBYTE,
      selectedDiffBytes: MEBIBYTE,
      upstreamOidBytes: KIBIBYTE,
      ignoredPathsBytes: 4 * MEBIBYTE,
      checkIgnoredBytes: MEBIBYTE,
      checkoutDirectoryBytes: 16 * KIBIBYTE,
      stashListBytes: MEBIBYTE,
      maxStashes: 100,
      contextLines: 3,
      submoduleStatusBytes: MEBIBYTE,
      filterConfigBytes: MEBIBYTE,
      filterPathsBytes: 8 * MEBIBYTE,
      filterAttributesBytes: 16 * MEBIBYTE,
      trackedPathsBytes: 4 * MEBIBYTE,
      maxTrackedPaths: WORKTREE_PATHS,
      headCommitBytes: 64 * KIBIBYTE,
      branchTrackingBytes: MEBIBYTE,
      discardedRefsBytes: 64 * KIBIBYTE,
      discardedBlobsBytes: 4 * MEBIBYTE,
      maxDiscarded: DISCARDED_CHANGES,
    },
    history: {
      defaultCommits: 50,
      maxCommits: COMMITS_PER_PAGE,
      maxFrontier: HISTORY_FRONTIER,
      maxCommitFiles: COMMIT_FILES,
      maxBranchBases: BRANCH_BASES,
      subjectBytes: 512,
      bodyBytes: 4096,
    },
    actions: {
      maxCommitPaths: CHANGED_PATHS,
      hookBytes: MEBIBYTE,
      maxNewFiles: 10_000,
    },
  },
  inventory: {
    listingLaunches: 4,
    listingTimeoutMs: 5 * SECOND_MS,
    staleAfterMs: 60 * SECOND_MS,
  },
  lanes: { readCapacity: 4, operationTimeoutMs: 30 * SECOND_MS },
  storage: { busyTimeoutMs: 5 * SECOND_MS },
  liveUpdates: {
    maxConnections: 64,
    maxWatchedWorktrees: 64,
    burstMs: 150,
    announcedEditMs: 300,
    heartbeatMs: 25 * SECOND_MS,
    pingMs: 30 * SECOND_MS,
    messageBytes: 64 * KIBIBYTE,
  },
  jobs: {
    refreshInventoryMs: 30 * SECOND_MS,
    collectAbsentWorktreesMs: HOUR_MS,
    flushDeviceActivityMs: MINUTE_MS,
    openRemoteRoutesMs: 5 * SECOND_MS,
  },
  http: {
    reviewBodyBytes: JSON_ESCAPE_FACTOR * REVIEW_SUMMARY_BYTES + MEBIBYTE,
    editFileBodyBytes: 8 * MEBIBYTE,
    corsMaxAgeSeconds: (10 * MINUTE_MS) / SECOND_MS,
  },
  locks: { startupWaitMs: 10 * SECOND_MS, pollMs: 25, staleTakeovers: 3 },
  installer: {
    command: {
      timeoutMs: MINUTE_MS,
      maxBytes: MEBIBYTE,
      processGroup: PROCESS_GROUP,
    },
    health: { attempts: 60, intervalMs: 250 },
  },
  listeners: { closeGraceMs: 5 * SECOND_MS },
  cli: {
    printedAddressLength: 60,
    printedIdLength: 80,
    shareSettleMs: 15 * SECOND_MS,
    sharePollMs: 250,
  },
  agents: {
    processGroup: PROCESS_GROUP,
    processDeadlineMs: 2 * MINUTE_MS,
    claudeOutputBytes: MEBIBYTE,
    codexOutputBytes: 4 * MEBIBYTE,
    codexCacheBytes: MEBIBYTE,
    plan: {
      maxGroups: 20,
      maxMessageLength: 16 * KIBIBYTE,
      maxPathLength: 4 * KIBIBYTE,
      maxPaths: 2000,
    },
  },
  network: {
    defaultPort: 3000,
    maxPort: 65535,
    maxHostnameLength: 253,
    ipv4Octets: 4,
  },
  owner: {
    requestTimeoutMs: 10 * SECOND_MS,
    probeTimeoutMs: 5 * SECOND_MS,
    quickProbeTimeoutMs: 500,
    mcpTimeoutMs: 2 * MINUTE_MS,
    socketPathBytes: 103,
  },
};

type RouteBudget = { p95Ms: number; gitProcesses: number };

export const ROUTE_BUDGET_REQUESTS = 5;

export const ROUTE_BUDGETS = {
  registerProject: { p95Ms: 150, gitProcesses: 7 },
  readInventory: { p95Ms: 100, gitProcesses: 0 },
  readChanges: { p95Ms: 600, gitProcesses: 6 },
  readGitStatus: { p95Ms: 500, gitProcesses: 10 },
  readTextFile: { p95Ms: 100, gitProcesses: 0 },
  readChangeDiffs: { p95Ms: 600, gitProcesses: 8 },
  listCommits: { p95Ms: 100, gitProcesses: 1 },
  listFileCommits: { p95Ms: 250, gitProcesses: 2 },
  listWorktreePaths: { p95Ms: 150, gitProcesses: 1 },
  listDirectory: { p95Ms: 150, gitProcesses: 1 },
  markReviewed: { p95Ms: 500, gitProcesses: 6 },
  listReviewed: { p95Ms: 100, gitProcesses: 0 },
  unmarkReviewed: { p95Ms: 100, gitProcesses: 0 },
  createComment: { p95Ms: 100, gitProcesses: 0 },
  listComments: { p95Ms: 100, gitProcesses: 0 },
  readPublishedReview: { p95Ms: SECOND_MS, gitProcesses: 8 },
} satisfies Record<string, RouteBudget>;
