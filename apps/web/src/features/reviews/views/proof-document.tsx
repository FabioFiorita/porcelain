import { BranchReviewPage } from './branch-review-page';
import type { ReviewScope } from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';
export function ProofDocument({
  scope,
  context,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
}) {
  return (
    <BranchReviewPage scope={scope} context={context} initialView="proof" />
  );
}
