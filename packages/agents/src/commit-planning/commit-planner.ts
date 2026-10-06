import { Context, Effect, Layer, Schema } from 'effect';
import { AiError, LanguageModel } from 'effect/ai';
import { commitPlanPrompt } from './commands/plan-commit.ts';
import { commitPlanSchema } from './dtos/commit-plan-schema.ts';
import type { AgentModel } from './dtos/agent-model.ts';
import type { CommitPlanLimits } from './dtos/agent-limits.ts';
import type { CommitPlanRequest } from './dtos/commit-plan-request.ts';
import type { CommitProposalGroup } from './dtos/commit-proposal-group.ts';
import { CommitPlanFailedError } from './errors/commit-plan-failed-error.ts';
import type { ProviderNotInstalledError } from './errors/provider-not-installed-error.ts';
import { ProviderProcessFailedError } from './errors/provider-process-failed-error.ts';
import { UnsupportedCommitModelError } from './errors/unsupported-commit-model-error.ts';
import { CodexProvider } from './codex-provider.ts';
import { ClaudeProvider } from './claude-provider.ts';

const modelName = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

export class CommitPlanner extends Context.Service<
  CommitPlanner,
  {
    readonly models: () => Effect.Effect<AgentModel[]>;
    readonly plan: (
      request: CommitPlanRequest,
    ) => Effect.Effect<
      CommitProposalGroup[],
      | CommitPlanFailedError
      | ProviderNotInstalledError
      | ProviderProcessFailedError
      | UnsupportedCommitModelError
    >;
  }
>()('@porcelain/agents/CommitPlanner') {
  static layer(limits: CommitPlanLimits) {
    return Layer.effect(
      CommitPlanner,
      Effect.gen(function* () {
        const codex = yield* CodexProvider;
        const claude = yield* ClaudeProvider;
        const schema = commitPlanSchema(limits);
        return {
          models: Effect.fn('CommitPlanner.models')(function* () {
            return (yield* Effect.all([codex.models(), claude.models()], {
              concurrency: 'unbounded',
            })).flat();
          }),
          plan: Effect.fn('CommitPlanner.plan')(function* (
            request: CommitPlanRequest,
          ) {
            const [providerName, name, extra] = request.model.split(':');
            const provider =
              providerName === 'codex'
                ? codex
                : providerName === 'claude'
                  ? claude
                  : undefined;
            if (
              !provider ||
              !name ||
              name === 'default' ||
              extra !== undefined ||
              !modelName.test(name)
            )
              return yield* Effect.fail(new UnsupportedCommitModelError());
            const model = yield* provider.model(name);
            const response = yield* LanguageModel.generateObject({
              prompt: commitPlanPrompt(request),
              schema,
              objectName: 'CommitPlan',
            }).pipe(
              Effect.provide(model),
              Effect.mapError((cause) =>
                cause.reason instanceof AiError.InvalidOutputError ||
                cause.reason instanceof AiError.StructuredOutputError ||
                cause.reason instanceof AiError.UnsupportedSchemaError
                  ? new CommitPlanFailedError({ cause })
                  : new ProviderProcessFailedError({ cause }),
              ),
            );
            const plan = yield* Schema.decodeUnknownEffect(
              Schema.fromJsonString(schema),
              { onExcessProperty: 'error' },
            )(response.text).pipe(
              Effect.mapError((cause) => new CommitPlanFailedError({ cause })),
            );
            return plan.groups.map((group) => ({
              message: group.message,
              paths: [...group.paths],
            }));
          }),
        };
      }),
    );
  }
}
