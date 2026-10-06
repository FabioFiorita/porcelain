import { homedir } from 'node:os';
import {
  Config,
  Context,
  Effect,
  FileSystem,
  Layer,
  Path,
  Schema,
} from 'effect';
import { ChildProcessSpawner } from 'effect/process';
import { findExecutable } from './commands/find-executable.ts';
import { codingModel } from './commands/coding-model.ts';
import { runProvider } from './commands/run-provider.ts';
import { readBoundedText } from './commands/read-bounded-text.ts';
import type { AgentLimits } from './dtos/agent-limits.ts';
import { ProviderNotInstalledError } from './errors/provider-not-installed-error.ts';
import { ProviderProcessFailedError } from './errors/provider-process-failed-error.ts';
import type { Provider } from './interfaces/provider.ts';
import { codexAnswer } from './parsers/parse-provider-answer.ts';

const modelSlug = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const modelCacheSchema = Schema.fromJsonString(
  Schema.Struct({
    models: Schema.Array(
      Schema.Struct({
        slug: Schema.String,
        display_name: Schema.String,
        visibility: Schema.optional(Schema.String),
      }),
    ),
  }),
);

export class CodexProvider extends Context.Service<CodexProvider, Provider>()(
  '@porcelain/agents/CodexProvider',
) {
  static layer(limits: AgentLimits) {
    return Layer.effect(
      CodexProvider,
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        const executable = (name: string) =>
          findExecutable(name).pipe(
            Effect.provideService(FileSystem.FileSystem, fs),
            Effect.provideService(Path.Path, path),
          );
        const models = Effect.fn('CodexProvider.models')(
          function* () {
            if (!(yield* executable('codex'))) return [];
            const home = yield* Config.String('CODEX_HOME').pipe(
              Config.withDefault(path.join(homedir(), '.codex')),
            );
            const text = yield* readBoundedText(
              path.join(home, 'models_cache.json'),
              limits.codexCacheBytes,
            ).pipe(Effect.provideService(FileSystem.FileSystem, fs));
            const listed =
              yield* Schema.decodeUnknownEffect(modelCacheSchema)(text);
            return listed.models
              .filter(
                (model) =>
                  model.visibility === 'list' && modelSlug.test(model.slug),
              )
              .map((model) => ({
                id: `codex:${model.slug}`,
                label: model.display_name,
              }));
          },
          Effect.orElseSucceed(() => []),
        );
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
                yield* runProvider({
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
                }).pipe(
                  Effect.provideService(
                    ChildProcessSpawner.ChildProcessSpawner,
                    spawner,
                  ),
                );
                const text = yield* readBoundedText(
                  outputPath,
                  limits.codexOutputBytes,
                ).pipe(Effect.provideService(FileSystem.FileSystem, fs));
                return yield* codexAnswer(text);
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
