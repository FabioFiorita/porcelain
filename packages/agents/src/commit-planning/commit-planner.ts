import type { AgentModel } from '../models/agent-model.ts';
import type { CommitPlanRequest } from '../models/commit-plan-request.ts';
import type { CommitProposalGroup } from '../models/commit-proposal-group.ts';
import type { Provider } from '../providers/provider.ts';
import { ProviderNotInstalledError } from '../providers/provider-not-installed-error.ts';
import { ProviderProcessFailedError } from '../providers/provider-process-failed-error.ts';
import { CommitPlanFailedError } from './commit-plan-failed-error.ts';
import {
  commitPlanOutputSchema,
  parseCommitPlan,
} from './commit-plan-output.ts';
import { commitPlanPrompt } from './commit-plan-prompt.ts';
import { UnsupportedCommitModelError } from './unsupported-commit-model-error.ts';

const modelName = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

export class CommitPlanner {
  private readonly providers: readonly Provider[];

  constructor(providers: readonly Provider[]) {
    this.providers = providers;
  }

  async models(signal?: AbortSignal): Promise<AgentModel[]> {
    const listed = await Promise.all(
      this.providers.map((provider) => provider.models(signal)),
    );
    return listed.flat();
  }

  async plan(
    request: CommitPlanRequest,
    signal?: AbortSignal,
  ): Promise<CommitProposalGroup[]> {
    const [providerName, model, extra] = request.model.split(':');
    const provider = this.providers.find(
      (candidate) => candidate.name === providerName,
    );
    if (
      !provider ||
      !model ||
      model === 'default' ||
      extra !== undefined ||
      !modelName.test(model)
    )
      throw new UnsupportedCommitModelError();
    try {
      return parseCommitPlan(
        await provider.answer(
          model,
          commitPlanPrompt(request),
          commitPlanOutputSchema,
          signal,
        ),
      );
    } catch (cause) {
      signal?.throwIfAborted();
      if (
        cause instanceof ProviderNotInstalledError ||
        cause instanceof ProviderProcessFailedError ||
        cause instanceof CommitPlanFailedError
      )
        throw cause;
      throw new CommitPlanFailedError({ cause });
    }
  }
}
