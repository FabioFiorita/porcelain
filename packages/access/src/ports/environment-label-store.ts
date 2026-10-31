import type { Effect } from 'effect';
import { Context } from 'effect';
import type { ChosenEnvironmentLabel } from '../models/environment-label.ts';

export interface EnvironmentLabelStore {
  read(): Effect.Effect<ChosenEnvironmentLabel>;
  save(input: ChosenEnvironmentLabel): Effect.Effect<void>;
}

export const EnvironmentLabelStore = Context.Service<
  '@porcelain/access/EnvironmentLabelStore',
  EnvironmentLabelStore
>('@porcelain/access/EnvironmentLabelStore');
