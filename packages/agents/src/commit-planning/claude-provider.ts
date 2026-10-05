import { Context, Effect, FileSystem, Layer, Path } from 'effect';
import { ChildProcessSpawner } from 'effect/process';
import { findExecutable } from './commands/find-executable.ts';
import { codingModel } from './commands/coding-model.ts';
import { runProvider } from './commands/run-provider.ts';
import type { AgentLimits } from './dtos/agent-limits.ts';
import { ProviderNotInstalledError } from './errors/provider-not-installed-error.ts';
import { ProviderProcessFailedError } from './errors/provider-process-failed-error.ts';
import type { Provider } from './interfaces/provider.ts';
import { claudeAnswer } from './parsers/parse-provider-answer.ts';

export class ClaudeProvider extends Context.Service<ClaudeProvider, Provider>()(
  '@porcelain/agents/ClaudeProvider',
) {
  static layer(limits: AgentLimits) {
    return Layer.effect(
      ClaudeProvider,
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        const executable = (name: string) =>
          findExecutable(name).pipe(
            Effect.provideService(FileSystem.FileSystem, fs),
            Effect.provideService(Path.Path, path),
          );
        const models = Effect.fn('ClaudeProvider.models')(
          function* () {
            if (!(yield* executable('claude'))) return [];
            return [
              { id: 'claude:sonnet', label: 'Sonnet' },
              { id: 'claude:haiku', label: 'Haiku' },
            ];
          },
          Effect.orElseSucceed(() => []),
        );
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

                const output = yield* runProvider({
                  command,
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
                }).pipe(
                  Effect.provideService(
                    ChildProcessSpawner.ChildProcessSpawner,
                    spawner,
                  ),
                );
                return yield* claudeAnswer(output);
              }).pipe(
                Effect.scoped,
                Effect.catchTag('PlatformError', (cause) =>
                  Effect.fail(new ProviderProcessFailedError({ cause })),
                ),
              ),
            );
          }),
        };
      }),
    );
  }
}
