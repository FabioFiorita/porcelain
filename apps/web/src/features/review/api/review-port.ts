import type {
  ChangeDiffs,
  ChangeDiffsRequest,
  ChangeLines,
  ChangeList,
  ReviewScope,
  Status,
} from '@/features/reviews/index';
type ReviewRequest = ReviewScope & {
  signal: AbortSignal;
};
export type ReviewPort = {
  status: (request: ReviewRequest) => Promise<Status>;
  diffs: (
    request: ReviewRequest & { input: ChangeDiffsRequest },
  ) => Promise<ChangeDiffs>;
  lines: (
    request: ReviewRequest & {
      path: string;
      from: number;
      to: number;
      at: 'head' | 'worktree';
    },
  ) => Promise<ChangeLines>;
  changes: (request: ReviewRequest) => Promise<{ changes: ChangeList }>;
};
