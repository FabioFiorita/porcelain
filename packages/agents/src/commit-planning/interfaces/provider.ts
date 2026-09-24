import type { AgentModel } from '../dtos/agent-model.ts';

export type Provider = {
  readonly name: string;
  models(signal?: AbortSignal): Promise<AgentModel[]>;
  answer(
    model: string,
    prompt: string,
    outputSchema: string,
    signal?: AbortSignal,
  ): Promise<unknown>;
};
