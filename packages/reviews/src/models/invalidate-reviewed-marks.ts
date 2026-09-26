export type InvalidateReviewedMarksResult = { changed: boolean };

export type InvalidateReviewedMarksInput = {
  worktreeId: string;
  paths?: readonly string[] | undefined;
};
