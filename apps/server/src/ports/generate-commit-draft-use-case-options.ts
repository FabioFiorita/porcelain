import { Context } from 'effect';
export type GenerateCommitDraftUseCaseOptions = { deadlineMs: number };
export const GenerateCommitDraftUseCaseOptions = Context.Service<
  '@porcelain/server/GenerateCommitDraftUseCaseOptions',
  GenerateCommitDraftUseCaseOptions
>('@porcelain/server/GenerateCommitDraftUseCaseOptions');
