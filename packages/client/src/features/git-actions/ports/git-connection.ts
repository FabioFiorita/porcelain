import type { Context } from 'effect';
import type { SecureRandom } from 'effect/crypto';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import type { OperationStore } from './operation-store.ts';

export type GitConnection = RuntimeConnection<
  OperationStore | SecureRandom.SecureRandom
> & {
  readonly operations: Context.Service.Shape<typeof OperationStore>;
};
