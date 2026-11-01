import type { ReviewComparison } from '../../../shared/rules/review-comparison';
export type ComparisonMenuProps = {
  comparison: ReviewComparison;
  label: string;
  maximumWidth?: number | undefined;
  base: string | undefined;
  bases: readonly { ref: string; name: string }[];
  onComparison: (comparison: ReviewComparison) => void;
};
