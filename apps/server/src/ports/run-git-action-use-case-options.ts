import { Context } from 'effect';
export type RunGitActionUseCaseOptions = { deadlineMs: number };
export const RunGitActionUseCaseOptions = Context.Service<
  '@porcelain/server/RunGitActionUseCaseOptions',
  RunGitActionUseCaseOptions
>('@porcelain/server/RunGitActionUseCaseOptions');
