import { Context, type Effect } from 'effect';
import type { MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';

export interface ReadInventoryUseCasePort {
  readonly execute: () => Effect.Effect<
    ReadInventoryResponse,
    MissingEnvironmentIdentityError
  >;
}
export const ReadInventoryUseCasePort = Context.Service<
  '@porcelain/server/ReadInventoryUseCasePort',
  ReadInventoryUseCasePort
>('@porcelain/server/ReadInventoryUseCasePort');
