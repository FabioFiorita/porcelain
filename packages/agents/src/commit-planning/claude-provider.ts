import {
  captureProviderRuntime,
  withProviderScope,
} from './commands/provider-runtime.ts';
import { claudeEnvironment } from '../shared/commands/claude-environment.ts';
import { Context, Effect, Layer } from 'effect';
import { codingModel } from './commands/coding-model.ts';
import type { AgentLimits } from './dtos/agent-limits.ts';
import { ProviderNotInstalledError } from './errors/provider-not-installed-error.ts';
import type { Provider } from './interfaces/provider.ts';
import { claudeAnswer } from './parsers/parse-provider-answer.ts';

export class ClaudeProvider extends Context.Service<ClaudeProvider, Provider>()(
  '@porcelain/agents/ClaudeProvider',
) {
  static layer(limits: AgentLimits) {
    return Layer.effect(
      ClaudeProvider,
      Effect.gen(function* () {
        const {
          fs,
          executable,
          models: installedModels,
          run,
        } = yield* captureProviderRuntime();
        const models = Effect.fn('ClaudeProvider.models')(function* () {
          return (yield* installedModels('claude', limits, false))
            .filter((model) => model.model !== 'claude-opus-5-5')
            .map((model) => ({
              id: `${model.provider}:${model.model}`,
              label: model.label,
            }));
        });
        return {
          models,
          model: Effect.fn('ClaudeProvider.model')(function* (model: string) {
            const command = yield* executable('claude');
            if (!command)
              return yield* Effect.fail(new ProviderNotInstalledError());
            return codingModel('claude-cli', model, (prompt, outputSchema) =>
              Effect.gen(function* () {
                const root = yield* fs.makeTempDirectoryScoped({
                  prefix: 'porcelain-commit-draft-',
                });

                const output = yield* run({
                  command,
                  env: claudeEnvironment(process.env),
                  args: [
                    '--print',
                    '--safe-mode',
                    '--restricted',
                    '--tools',
                    '',
                    '--strict-mcp-config',
                    '--no-session-persistence',
                    '--output-format',
                    'json',
                    '--json-schema',
                    outputSchema,
                    '--model',
                    model,
                  ],
                  cwd: root,
                  prompt,
                  maxBytes: limits.claudeOutputBytes,
                  timeoutMs: limits.processDeadlineMs,
                  processGroup: limits.processGroup,
                });
                return yield* claudeAnswer(output);
              }).pipe(withProviderScope),
            );
          }),
        };
      }),
    );
  }
}
