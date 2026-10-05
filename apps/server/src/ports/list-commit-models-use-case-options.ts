import { Context } from 'effect';
export type ListCommitModelsUseCaseOptions = { deadlineMs: number };
export const ListCommitModelsUseCaseOptions = Context.Service<
  '@porcelain/server/ListCommitModelsUseCaseOptions',
  ListCommitModelsUseCaseOptions
>('@porcelain/server/ListCommitModelsUseCaseOptions');
