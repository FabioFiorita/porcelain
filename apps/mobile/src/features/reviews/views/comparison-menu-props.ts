import type { ReviewComparison } from '../../../shared/rules/review-comparison';
export type ComparisonMenuProps = {
  comparison: ReviewComparison;
  bases: readonly { ref: string; name: string }[];
  onComparison: (comparison: ReviewComparison) => void;
};
