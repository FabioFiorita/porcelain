import type { AgentModel } from '../models/agent-model.ts';

export interface Provider {
  readonly name: string;
  models(signal?: AbortSignal): Promise<AgentModel[]>;
  answer(
    model: string,
    prompt: string,
    outputSchema: string,
    signal?: AbortSignal,
  ): Promise<unknown>;
}
