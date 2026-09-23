export interface GitActionRetentionStore {
  deleteFinishedBefore(cutoff: number): void;
}
