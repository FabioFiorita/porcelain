import type { Context, Crypto } from 'effect';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import type { OperationStore } from './operation-store.ts';

export type GitConnection = RuntimeConnection<
  OperationStore | Crypto.Crypto
> & {
  readonly operations: Context.Service.Shape<typeof OperationStore>;
};
