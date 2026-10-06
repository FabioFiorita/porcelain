import type {
  IdentifyRequestClientInput,
  RequestClient,
} from '@porcelain/access/models';
import type { Effect } from 'effect';

export type IdentifiedClient = RequestClient;

export interface IdentifyRequestClientUseCasePort {
  execute(input: IdentifyRequestClientInput): Effect.Effect<IdentifiedClient>;
}
