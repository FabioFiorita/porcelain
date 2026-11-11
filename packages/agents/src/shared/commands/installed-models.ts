import { homedir } from 'node:os';
import { Config, Effect, Path, Schema } from 'effect';
import { runCommand } from '@porcelain/process';
import {
  claudeEffortSchema,
  writerEffortSchema,
  type WalkthroughModel,
} from '@porcelain/walkthroughs/models';
import { findExecutable } from './find-executable.ts';
import { claudeEnvironment } from './claude-environment.ts';
import { readBoundedText } from '../../commit-planning/commands/read-bounded-text.ts';
import type { AgentLimits } from '../../commit-planning/dtos/agent-limits.ts';
const cacheSchema = Schema.fromJsonString(
  Schema.Struct({
    models: Schema.Array(
      Schema.Struct({
        slug: Schema.String,
        display_name: Schema.String,
        visibility: Schema.optional(Schema.String),
        default_reasoning_level: Schema.optional(writerEffortSchema),
        supported_reasoning_levels: Schema.optional(
          Schema.Array(Schema.Struct({ effort: writerEffortSchema })),
        ),
      }),
    ),
  }),
);
export const installedModels = Effect.fn('Agents.installedModels')(
  function* (
    provider: 'claude' | 'codex',
    limits: AgentLimits,
    signedInOnly: boolean,
  ) {
    const path = yield* Path.Path;
    const home = yield* Config.String('CODEX_HOME').pipe(
      Config.withDefault(path.join(homedir(), '.codex')),
    );
    const command = yield* findExecutable(provider);
    if (!command) return [];
    if (signedInOnly) {
      const result = yield* runCommand({
        command,
        env:
          provider === 'claude'
            ? claudeEnvironment(process.env)
            : { ...process.env, CODEX_HOME: home },
        args:
          provider === 'claude'
            ? ['auth', 'status', '--json']
            : ['login', 'status'],
        maxBytes: 16384,
        timeoutMs: limits.processDeadlineMs,
        processGroup: limits.processGroup,
      });
      if (result.exitCode !== 0 || result.stopped || !result.groupStopped)
        return [];
      if (provider === 'claude') {
        const status = yield* Schema.decodeUnknownEffect(
          Schema.fromJsonString(Schema.Struct({ loggedIn: Schema.Boolean })),
        )(result.stdout.toString('utf8'));
        if (!status.loggedIn) return [];
      }
    }
    if (provider === 'claude')
      return [
        {
          provider,
          model: 'claude-opus-5-5',
          label: 'Opus 5.5',
          efforts: claudeEffortSchema.literals,
          defaultEffort: 'high' as const,
        },
        {
          provider,
          model: 'sonnet',
          label: 'Sonnet',
          efforts: claudeEffortSchema.literals,
          defaultEffort: 'high' as const,
        },
        {
          provider,
          model: 'haiku',
          label: 'Haiku',
          efforts: claudeEffortSchema.literals,
          defaultEffort: 'high' as const,
        },
      ];
    const text = yield* readBoundedText(
      path.join(home, 'models_cache.json'),
      limits.codexCacheBytes,
    );
    const listed = yield* Schema.decodeUnknownEffect(cacheSchema)(text);
    return listed.models
      .filter(
        (model) =>
          model.visibility === 'list' &&
          /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(model.slug),
      )
      .map((model): WalkthroughModel => ({
        provider,
        model: model.slug,
        label: model.display_name,
        efforts:
          model.supported_reasoning_levels?.map((level) => level.effort) ?? [],
        defaultEffort: model.default_reasoning_level ?? 'medium',
      }));
  },
  Effect.orElseSucceed(() => [] as readonly WalkthroughModel[]),
);
