import {
  captureProviderRuntime,
  withProviderScope,
} from './commands/provider-runtime.ts';
import { Context, Effect, Layer, FileSystem } from 'effect';
import { codingModel } from './commands/coding-model.ts';
import { readBoundedText } from './commands/read-bounded-text.ts';
import type { AgentLimits } from './dtos/agent-limits.ts';
import { ProviderNotInstalledError } from './errors/provider-not-installed-error.ts';
import type { Provider } from './interfaces/provider.ts';
import { codexAnswer } from './parsers/parse-provider-answer.ts';

export class CodexProvider extends Context.Service<CodexProvider, Provider>()(
  '@porcelain/agents/CodexProvider',
) {
  static layer(limits: AgentLimits) {
    return Layer.effect(
      CodexProvider,
      Effect.gen(function* () {
        const {
          fs,
          path,
          executable,
          models: installedModels,
          run,
        } = yield* captureProviderRuntime();
        const models = Effect.fn('CodexProvider.models')(function* () {
          return (yield* installedModels('codex', limits, false)).map(
            (model) => ({
              id: `${model.provider}:${model.model}`,
              label: model.label,
            }),
          );
        });
        return {
          models,
          model: Effect.fn('CodexProvider.model')(function* (model: string) {
            const command = yield* executable('codex');
            if (!command)
              return yield* Effect.fail(new ProviderNotInstalledError());
            return codingModel('codex-cli', model, (prompt, outputSchema) =>
              Effect.gen(function* () {
                const root = yield* fs.makeTempDirectoryScoped({
                  prefix: 'porcelain-commit-draft-',
                });
                const schemaPath = path.join(root, 'schema.json');
                const outputPath = path.join(root, 'result.json');
                yield* fs.writeFileString(schemaPath, outputSchema);
                yield* run({
                  command,
                  args: [
                    'exec',
                    '--ignore-user-config',
                    '--ignore-rules',
                    '--ephemeral',
                    '--skip-git-repo-check',
                    '--sandbox',
                    'read-only',
                    '--disable',
                    'shell_tool',
                    '--disable',
                    'multi_agent',
                    '--disable',
                    'apps',
                    '--disable',
                    'plugins',
                    '-c',
                    'project_doc_max_bytes=0',
                    '-c',
                    'web_search="disabled"',
                    '--output-schema',
                    schemaPath,
                    '--output-last-message',
                    outputPath,
                    '--model',
                    model,
                    '-',
                  ],
                  cwd: root,
                  prompt,
                  maxBytes: limits.codexOutputBytes,
                  timeoutMs: limits.processDeadlineMs,
                  processGroup: limits.processGroup,
                });
                const text = yield* readBoundedText(
                  outputPath,
                  limits.codexOutputBytes,
                ).pipe(Effect.provideService(FileSystem.FileSystem, fs));
                return yield* codexAnswer(text);
              }).pipe(withProviderScope),
            );
          }),
        };
      }),
    );
  }
}
