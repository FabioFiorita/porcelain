import type { Effect } from 'effect';
import { Context } from 'effect';
export interface EnvironmentIdentityReader {
  environmentId(): Effect.Effect<string | undefined>;
}

export const EnvironmentIdentityReader = Context.Service<
  '@porcelain/access/EnvironmentIdentityReader',
  EnvironmentIdentityReader
>('@porcelain/access/EnvironmentIdentityReader');
