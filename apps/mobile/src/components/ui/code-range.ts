export type ReviewRange = {
  startLine: number;
  endLine: number;
  side?: 'additions' | 'deletions' | undefined;
};
