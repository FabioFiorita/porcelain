export type CommitPlanRequest = {
  mode: 'message' | 'groups';
  model: string;
  paths: string[];
  evidence: string;
};
