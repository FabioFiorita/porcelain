import type {
  commitDraftRequestSchema,
  commitDraftResponseSchema,
  commitModelsSchema,
} from '@porcelain/contracts/commit-draft';
export type CommitDraftInput = ReturnType<
  typeof commitDraftRequestSchema.parse
>;
export type CommitDraft = ReturnType<typeof commitDraftResponseSchema.parse>;
export type CommitModel = ReturnType<typeof commitModelsSchema.parse>[number];

import type {
  gitActionPreparationSchema,
  gitActionReceiptSchema,
} from '@porcelain/contracts/git-actions';
export type Preparation = ReturnType<typeof gitActionPreparationSchema.parse>;
export type Receipt = ReturnType<typeof gitActionReceiptSchema.parse>;
export type GitAction = Preparation['action'];
export type ActionInput =
  | { remoteName: string; sourceRef: string }
  | { remoteName: string; destinationRef: string; allowCreate: boolean }
  | {
      message: string;
      paths?: string[];
      expectedFiles?: { path: string; fingerprint: string }[];
    }
  | { message: string; includeUntracked: boolean }
  | { stashOid: string; restoreIndex: boolean };
export type Operation = {
  requestId: string;
  preparationId: string;
  receipt?: Receipt;
};
