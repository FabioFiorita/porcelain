export type CommitPlanLimits = {
  maxGroups: number;
  maxMessageLength: number;
  maxPathLength: number;
  maxPaths: number;
};

export type AgentLimits = {
  processDeadlineMs: number;
  claudeOutputBytes: number;
  codexOutputBytes: number;
  codexCacheBytes: number;
  plan: CommitPlanLimits;
};
