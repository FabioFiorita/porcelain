import { Context } from 'effect';
export type ReadEnvironmentUseCaseOptions = {
  version: string | undefined;
  protocol: number;
};
export const ReadEnvironmentUseCaseOptions = Context.Service<
  '@porcelain/server/ReadEnvironmentUseCaseOptions',
  ReadEnvironmentUseCaseOptions
>('@porcelain/server/ReadEnvironmentUseCaseOptions');
