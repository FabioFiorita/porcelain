import type { Effect } from 'effect';
import type { LanguageModel, Model } from 'effect/ai';
import type { AgentModel } from '../dtos/agent-model.ts';
import type { ProviderNotInstalledError } from '../errors/provider-not-installed-error.ts';

export interface Provider {
  models(): Effect.Effect<AgentModel[]>;
  model(
    name: string,
  ): Effect.Effect<
    Model.Model<string, LanguageModel.LanguageModel, never>,
    ProviderNotInstalledError
  >;
}
