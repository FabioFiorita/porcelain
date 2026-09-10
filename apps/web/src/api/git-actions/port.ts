import type {
  ActionInput,
  GitAction,
  Preparation,
  Receipt,
} from '../../domain/git-action';
import type { ReviewRequest } from '../review/port';
export type GitActionsPort = {
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
