import type {
  ReviewRevision,
  ReviewStep,
} from '@porcelain/client/reviews/rules';
import { guardRequest } from '@porcelain/client/reviews/rules';
import { ReviewRequest } from './review-request';
import type { WalkthroughProps } from './walkthrough-props';

export function GuardRequest({
  step,
  revision,
  scope,
  context,
}: Pick<WalkthroughProps, 'scope' | 'context'> & {
  step: ReviewStep;
  revision: ReviewRevision;
}) {
  return (
    <div className="border-t px-3 py-2">
      <ReviewRequest
        label="Ask for a guard"
        body={guardRequest(step)}
        revision={revision}
        scope={scope}
        context={context}
      />
    </div>
  );
}
