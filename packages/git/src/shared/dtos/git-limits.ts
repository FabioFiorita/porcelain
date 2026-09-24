import type { ProcessGroupLimits } from '@porcelain/process';

export type GitLimits = {
  processGroup: ProcessGroupLimits;
  readTimeoutMs: number;
  outputBytes: number;
  followUpTimeoutMs: number;
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
    subjectBytes: number;
    bodyBytes: number;
  };
  actions: {
    maxCommitPaths: number;
    hookBytes: number;
    maxNewFiles: number;
  };
};
