import type {
  ActionInput,
  CommitDraft,
  CommitDraftInput,
  CommitModel,
  GitAction,
  Preparation,
  Receipt,
} from '../../domain/git-action';
import type { ReviewRequest } from '../review/port';
export type GitActionsPort = {
  models: (
    request: Pick<ReviewRequest, 'token' | 'signal'>,
  ) => Promise<CommitModel[]>;
  draft: (
    request: ReviewRequest & { input: CommitDraftInput },
  ) => Promise<CommitDraft>;
  prepare: (
    request: ReviewRequest & { action: GitAction; input: ActionInput },
  ) => Promise<Preparation>;
  execute: (
    request: ReviewRequest & {
      action: GitAction;
      preparationId: string;
      requestId: string;
    },
  ) => Promise<Receipt>;
  receipt: (request: ReviewRequest & { requestId: string }) => Promise<Receipt>;
};
