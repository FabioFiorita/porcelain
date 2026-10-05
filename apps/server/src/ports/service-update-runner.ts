import { type Effect, Context } from 'effect';
import {
  type ServiceUpdateCheck,
  type ServiceUpdateState,
  type ServiceUpdateTarget,
} from '@porcelain/access/models';

export interface ServiceUpdateRunner {
  read(input: ServiceUpdateCheck): Effect.Effect<ServiceUpdateState>;
  start(input: ServiceUpdateTarget): Effect.Effect<void>;
  close(): Effect.Effect<void>;
}

export const ServiceUpdateRunner = Context.Service<
  '@porcelain/server/ServiceUpdateRunner',
  ServiceUpdateRunner
>('@porcelain/server/ServiceUpdateRunner');
