export type ReviewedLayerMark = {
  layerId: string;
  fingerprint: string;
  reviewedAt: string;
  stale: boolean;
};

export type SetReviewedLayerInput = {
  layerId: string;
  fingerprint: string;
  reviewed: true;
};
