import type { ReviewComparison } from '../rules/comparison';
export type ComparisonMenuProps = {
  comparison: ReviewComparison;
  bases: readonly { ref: string; name: string }[];
  onComparison: (comparison: ReviewComparison) => void;
};
