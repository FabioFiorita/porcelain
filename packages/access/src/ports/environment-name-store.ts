import type { Effect } from 'effect';
import { Context } from 'effect';
import type { ChosenEnvironmentName } from '../models/environment-name.ts';

export interface EnvironmentNameStore {
  read(): Effect.Effect<ChosenEnvironmentName>;
  save(input: ChosenEnvironmentName): Effect.Effect<void>;
}

export const EnvironmentNameStore = Context.Service<
  '@porcelain/access/EnvironmentNameStore',
  EnvironmentNameStore
>('@porcelain/access/EnvironmentNameStore');
