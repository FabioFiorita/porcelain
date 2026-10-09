import type {
  ReviewResponse,
  ReviewScope,
} from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';
import type { DocumentInteraction, OpenDocument } from '../rules/documents';

export type WalkthroughProps = {
  review: ReviewResponse;
  scope: ReviewScope;
  context: ConnectionContext;
  interaction: DocumentInteraction;
  onOpen: OpenDocument;
};
