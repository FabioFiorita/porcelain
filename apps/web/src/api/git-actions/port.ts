import type {
  BranchesResponse,
  CommitDraft,
  CommitDraftInput,
  CommitModel,
  Receipt,
  RunGitActionRequest,
} from '../../domain/git-action';
import type { ReviewRequest } from '../review/port';
export type GitActionsPort = {
  models: (request: Pick<ReviewRequest, 'signal'>) => Promise<CommitModel[]>;
  draft: (
    request: ReviewRequest & { input: CommitDraftInput },
  ) => Promise<CommitDraft>;
  run: (
    request: ReviewRequest & { input: RunGitActionRequest },
  ) => Promise<Receipt>;
  branches: (request: ReviewRequest) => Promise<BranchesResponse>;
  dismissInterrupted: (
    request: ReviewRequest & { requestId: string },
  ) => Promise<void>;
  receipt: (request: ReviewRequest & { requestId: string }) => Promise<Receipt>;
};
