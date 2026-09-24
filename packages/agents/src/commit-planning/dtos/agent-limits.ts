import type { ProcessGroupLimits } from '@porcelain/process';

export type CommitPlanLimits = {
  maxGroups: number;
  maxMessageLength: number;
  maxPathLength: number;
  maxPaths: number;
};

export type AgentLimits = {
  processGroup: ProcessGroupLimits;
  processDeadlineMs: number;
  claudeOutputBytes: number;
  codexOutputBytes: number;
  codexCacheBytes: number;
  plan: CommitPlanLimits;
};
