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
  | { message: string }
  | { message: string; includeUntracked: boolean }
  | { stashOid: string; restoreIndex: boolean };
export type Operation = {
  requestId: string;
  preparationId: string;
  receipt?: Receipt;
};
