import { Context } from 'effect';
export interface EnvironmentIdentityReader {
  environmentId(): string | undefined;
}

export const EnvironmentIdentityReader = Context.Service<
  '@porcelain/access/EnvironmentIdentityReader',
  EnvironmentIdentityReader
>('@porcelain/access/EnvironmentIdentityReader');
