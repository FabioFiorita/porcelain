import type { Effect } from 'effect';
import type {
  ServiceUpdateCheck,
  ServiceUpdateState,
  ServiceUpdateTarget,
} from '@porcelain/access/models';

export interface ServiceUpdateRunner {
  read(input: ServiceUpdateCheck): Effect.Effect<ServiceUpdateState>;
  start(input: ServiceUpdateTarget): Effect.Effect<void>;
  close(): Effect.Effect<void>;
}
