import { planCommit } from './commands/plan-commit.ts';
import type { AgentModel } from './dtos/agent-model.ts';
import type { CommitPlanRequest } from './dtos/commit-plan-request.ts';
import type { CommitProposalGroup } from './dtos/commit-proposal-group.ts';
import { CommitPlanFailedError } from './errors/commit-plan-failed-error.ts';
import { ProviderNotInstalledError } from './errors/provider-not-installed-error.ts';
import { ProviderProcessFailedError } from './errors/provider-process-failed-error.ts';
import { UnsupportedCommitModelError } from './errors/unsupported-commit-model-error.ts';
import type { Provider } from './interfaces/provider.ts';
import type { AgentLimits, CommitPlanLimits } from './dtos/agent-limits.ts';
import {
  commitPlanParser,
  type CommitPlanParser,
} from './parsers/parse-commit-plan.ts';
import { ClaudeProvider } from './providers/claude.ts';
import { CodexProvider } from './providers/codex.ts';

const modelName = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

export class CommitPlanner {
  private readonly providers: readonly Provider[];
  private readonly parser: CommitPlanParser;

  constructor(providers: readonly Provider[], limits: CommitPlanLimits) {
    this.providers = providers;
    this.parser = commitPlanParser(limits);
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
      return this.parser.parse(
        await planCommit(
          provider,
          model,
          request,
          this.parser.outputSchema,
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

export function createCommitPlanner(limits: AgentLimits): CommitPlanner {
  return new CommitPlanner(
    [new CodexProvider(limits), new ClaudeProvider(limits)],
    limits.plan,
  );
}
