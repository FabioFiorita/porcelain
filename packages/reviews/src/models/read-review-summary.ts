export type ReadReviewSummaryInput = {
  token: string;
  expires: string;
  signature: string;
};

export type ReadReviewSummaryResult = {
  html: string;
};
