import type { ReviewResponse } from '@porcelain/client/reviews/rules';
import type { ReviewScope } from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';
import type { DocumentInteraction, OpenDocument } from '../../workspace/index';

export type WalkthroughProps = {
  review: ReviewResponse;
  scope: ReviewScope;
  context: ConnectionContext;
  interaction: DocumentInteraction;
  onOpen: OpenDocument;
};
