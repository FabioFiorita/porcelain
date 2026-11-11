import { providerFailure, logProviderFailure } from './provider-failure.ts';
import { codexOutputSchema } from './codex-output-schema.ts';
import { writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Effect, FileSystem, Result, Schema } from 'effect';
import { Toml } from 'effect/encoding';
import { ChildProcessSpawner } from 'effect/process';
import type { WalkthroughWriterChoice } from '@porcelain/walkthroughs/models';
import { WalkthroughFailedError } from '@porcelain/walkthroughs/errors';
import type { ProcessGroupLimits } from '@porcelain/process';
import { runProvider } from '../commit-planning/commands/run-provider.ts';
import { readBoundedText } from '../commit-planning/commands/read-bounded-text.ts';

const envelopeSchema = Schema.Struct({
  structured_output: Schema.optional(Schema.Unknown),
  session_id: Schema.optional(Schema.String),
  total_cost_usd: Schema.optional(Schema.Number),
  is_error: Schema.optional(Schema.Boolean),
  result: Schema.optional(Schema.String),
});
const eventSchema = Schema.Struct({
  type: Schema.String,
  thread_id: Schema.optional(Schema.String),
  message: Schema.optional(Schema.String),
  error: Schema.optional(
    Schema.Struct({ message: Schema.optional(Schema.String) }),
  ),
});
const codexErrorDetail = (output: string) => {
  let lastError: string | undefined;
  for (const line of output.split('\n')) {
    const decoded = Schema.decodeUnknownResult(
      Schema.fromJsonString(eventSchema),
    )(line);
    if (Result.isSuccess(decoded)) {
      const event = decoded.success;
      if (event.type === 'error' || event.type === 'turn.failed') {
        const detail = event.error?.message ?? event.message;
        if (detail) lastError = detail;
      }
    }
  }
  return lastError ?? output;
};
const signedOutResult = /sign.?in|login|oauth|token.*expired|unauthorized/i;
const signedOutOutput =
  /not logged in|sign.?in|login|authentication|oauth|token.*expired|unauthorized/i;
const CODEX_ISOLATION = [
  '-c',
  'notify=[]',
  '-c',
  'allow_login_shell=false',
  '-c',
  'shell_environment_policy.experimental_use_profile=false',
  '-c',
  'web_search="disabled"',
  '--disable',
  'shell_snapshot',
  '--disable',
  'shell_snapshot_v2',
  '--disable',
  'browser_use',
  '--disable',
  'computer_use',
  '--disable',
  'image_generation',
  '-c',
  'features.hooks=false',
  '--disable',
  'plugins',
  '--disable',
  'apps',
  '--disable',
  'multi_agent',
  '--disable',
  'multi_agent_v2',
  '--disable',
  'skill_mcp_dependency_install',
];
const mcpServersSchema = Schema.fromJsonString(
  Schema.Array(
    Schema.Struct({
      name: Schema.String,
      enabled: Schema.Boolean,
      transport: Schema.Union([
        Schema.Struct({
          type: Schema.Literal('stdio'),
          command: Schema.String,
        }),
        Schema.Struct({
          type: Schema.Literal('streamable_http'),
          url: Schema.String,
        }),
      ]),
    }),
  ),
);

export const failure = (
  kind: WalkthroughFailedError['kind'],
  message: string,
) => new WalkthroughFailedError({ kind, message });

export const unavailableWriter = (writer: {
  provider: string;
  model: string;
}) =>
  failure(
    'other',
    `The walkthrough model ${writer.provider}/${writer.model} is unavailable. Install the CLI and sign in, or choose another model in walkthrough settings.`,
  );
const modelRefused = (detail: string) =>
  /model.*(?:not.*(?:available|exist|found|support)|unavailable|no access)|no access.*model/i.test(
    detail,
  );

export type AgentTurnWording = {
  readonly timedOut: string;
  readonly stopped: string;
  readonly unusable: string;
};

export type AgentTurn = {
  readonly provider: 'claude' | 'codex';
  readonly model: string;
  readonly effort: WalkthroughWriterChoice['effort'];
  readonly worktreePath: string;
  readonly folder: string;
  readonly session: {
    readonly kind: 'new' | 'resume';
    readonly id: string;
  };
  readonly label: string;
  readonly schema: Schema.Top | undefined;
  readonly images: readonly string[];
  readonly prompt: string;
  readonly timeoutMs: number;
  readonly wording: AgentTurnWording;
};

type AgentTurnResult = {
  readonly sessionId: string;
  readonly costUsd: number | undefined;
  readonly output: unknown;
};

const isolatedEnvironment = (folder: string) => ({
  ...process.env,
  HOME: folder,
  CODEX_HOME: process.env.CODEX_HOME ?? join(homedir(), '.codex'),
  CLAUDE_CONFIG_DIR:
    process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude'),
  BASH_ENV: '',
  ENV: '',
  ZDOTDIR: folder,
  CLAUDE_CODE_SHELL: '',
  CLAUDE_CODE_PLUGIN_DIRS: '',
  CLAUDE_CODE_SHELL_PREFIX: '',
  CLAUDE_CODE_PROCESS_WRAPPER: '',
  CLAUDE_CODE_SHELL_LAUNCHER_SCRIPT: '',
  NODE_OPTIONS: '',
  BUN_OPTIONS: '',
  GIT_NO_LAZY_FETCH: '1',
  GIT_CONFIG_COUNT: '2',
  GIT_CONFIG_KEY_0: 'core.hooksPath',
  GIT_CONFIG_VALUE_0: '/dev/null',
  GIT_CONFIG_KEY_1: 'core.fsmonitor',
  GIT_CONFIG_VALUE_1: 'false',
});

export const agentTurns = (options: {
  readonly processGroup: ProcessGroupLimits;
  readonly command?: string | undefined;
}) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const provideSpawner = Effect.provideService(
      ChildProcessSpawner.ChildProcessSpawner,
      spawner,
    );
    const codexIsolation = Effect.fn('AgentTurns.codexIsolation')(function* (
      turn: AgentTurn,
      command: string,
      env: ReturnType<typeof isolatedEnvironment>,
    ) {
      const configArgs = [...CODEX_ISOLATION];
      const credentialsStore = yield* fs
        .readFileString(join(env.CODEX_HOME, 'config.toml'))
        .pipe(
          Effect.flatMap((text) => Effect.fromResult(Toml.parse(text))),
          Effect.flatMap(
            Schema.decodeUnknownEffect(
              Schema.Struct({
                cli_auth_credentials_store: Schema.Literals([
                  'file',
                  'keyring',
                  'auto',
                ]),
              }),
            ),
          ),
          Effect.map((config) => config.cli_auth_credentials_store),
          Effect.catch(() => Effect.succeed(undefined)),
        );
      if (credentialsStore !== undefined)
        configArgs.push(
          '-c',
          `cli_auth_credentials_store=${JSON.stringify(credentialsStore)}`,
        );
      const mcpOverrides: string[] = [];
      for (let check = 0; check < 2; check++) {
        const servers = yield* runProvider({
          command,
          args: ['mcp', 'list', '--json', ...configArgs, ...mcpOverrides],
          cwd: turn.worktreePath,
          env,
          prompt: '',
          maxBytes: 4 * 1024 * 1024,
          timeoutMs: Math.min(turn.timeoutMs, 10000),
          processGroup: options.processGroup,
        }).pipe(
          provideSpawner,
          Effect.flatMap(Schema.decodeUnknownEffect(mcpServersSchema)),
          Effect.mapError((error) =>
            failure(
              error._tag === 'ProviderProcessFailedError' &&
                error.cause !== undefined
                ? 'agent_not_installed'
                : 'other',
              'The Codex MCP servers could not be disabled. Check its configuration, then try again.',
            ),
          ),
        );
        if (check === 0)
          mcpOverrides.push(
            '-c',
            `mcp_servers={${servers.map((server) => `${JSON.stringify(server.name)}={enabled=false,${server.transport.type === 'stdio' ? `command=${JSON.stringify(server.transport.command)}` : `url=${JSON.stringify(server.transport.url)}`}}`).join(',')}}`,
          );
        else if (servers.some((server) => server.enabled))
          return yield* failure(
            'other',
            'The Codex MCP servers could not be disabled. Check its configuration, then try again.',
          );
      }
      return [...configArgs, ...mcpOverrides];
    });
    const run = Effect.fn('AgentTurns.run')(function* (turn: AgentTurn) {
      const env = isolatedEnvironment(turn.folder);
      const command = options.command ?? turn.provider;
      const resuming = turn.session.kind === 'resume';
      const answerPath = join(turn.folder, `answer-${turn.label}.json`);
      const args: string[] = [];
      if (turn.provider === 'claude') {
        args.push(
          '-p',
          '--safe-mode',
          '--model',
          turn.model,
          '--effort',
          turn.effort,
          '--output-format',
          'json',
        );
        if (turn.schema !== undefined)
          args.push(
            '--json-schema',
            JSON.stringify(Schema.toJsonSchemaDocument(turn.schema).schema),
          );
        args.push(
          '--tools',
          'Read,Grep,Glob,Bash',
          '--allowedTools',
          'Read,Grep,Glob,Bash(git diff:*),Bash(git log:*),Bash(git show:*)',
          '--disallowedTools',
          'Bash(git * --output*),Bash(git * -o *)',
          '--setting-sources',
          '',
          '--settings',
          '{"disableAllHooks":true}',
          '--strict-mcp-config',
          '--mcp-config',
          '{"mcpServers":{}}',
          '--disable-slash-commands',
          '--permission-mode',
          'dontAsk',
          resuming ? '--resume' : '--session-id',
          turn.session.id,
        );
        if (turn.images.length) args.push('--add-dir', turn.folder);
      } else {
        const isolation = yield* codexIsolation(turn, command, env);
        args.push(
          ...(resuming
            ? ['exec', 'resume', '-c', 'sandbox_mode="read-only"']
            : ['exec', '--sandbox', 'read-only']),
          ...isolation,
          '-c',
          `model_reasoning_effort=${JSON.stringify(turn.effort)}`,
          '--ignore-user-config',
          '--ignore-rules',
          '--json',
          '--model',
          turn.model,
        );
        if (turn.schema !== undefined) {
          const schemaPath = join(turn.folder, `schema-${turn.label}.json`);
          const schema = codexOutputSchema(turn.schema);
          yield* Effect.tryPromise(() =>
            writeFile(schemaPath, JSON.stringify(schema)),
          );
          args.push('--output-schema', schemaPath);
        }
        args.push('--output-last-message', answerPath);
        if (resuming) args.push(turn.session.id);
        args.push('-');
        if (resuming) for (const path of turn.images) args.push('-i', path);
      }
      const failureDetail = (detail = '') =>
        turn.provider === 'codex' ? codexErrorDetail(detail) : detail;
      const output = yield* runProvider({
        command,
        args,
        cwd: turn.worktreePath,
        env,
        prompt: turn.prompt,
        maxBytes: 4 * 1024 * 1024,
        timeoutMs: turn.timeoutMs,
        processGroup: options.processGroup,
      }).pipe(
        provideSpawner,
        Effect.tapError((error) =>
          logProviderFailure(
            providerFailure(
              turn.provider,
              failureDetail(error.detail),
              turn.wording.stopped,
            ),
            failureDetail(error.detail),
          ),
        ),
        Effect.mapError((error) => {
          const detail = failureDetail(error.detail);
          if (error.reason === 'deadline')
            return failure('timed_out', turn.wording.timedOut);
          if (
            /invalid_request_error|invalid_json_schema|invalid schema/i.test(
              detail,
            )
          )
            return providerFailure(turn.provider, detail, turn.wording.stopped);
          if (signedOutOutput.test(detail))
            return failure(
              'signed_out',
              'Sign in again to the selected agent CLI, then try again.',
            );
          if (modelRefused(detail)) return unavailableWriter(turn);
          if (error.cause !== undefined)
            return failure(
              'agent_not_installed',
              'The selected agent CLI could not be started. Check that it is installed.',
            );
          return providerFailure(turn.provider, detail, turn.wording.stopped);
        }),
      );
      if (turn.provider === 'claude') {
        const envelope = yield* Schema.decodeUnknownEffect(
          Schema.fromJsonString(envelopeSchema),
        )(output).pipe(
          Effect.mapError(() =>
            failure('unusable_output', turn.wording.unusable),
          ),
        );
        if (envelope.is_error && modelRefused(envelope.result ?? ''))
          return yield* unavailableWriter(turn);
        if (envelope.is_error)
          return yield* signedOutResult.test(envelope.result ?? '')
            ? failure('signed_out', 'Sign in again to the selected agent CLI.')
            : failure('other', turn.wording.stopped);
        return {
          sessionId: envelope.session_id ?? turn.session.id,
          costUsd: envelope.total_cost_usd,
          output:
            turn.schema === undefined
              ? (envelope.result ?? '')
              : envelope.structured_output,
        } satisfies AgentTurnResult;
      }
      let sessionId = turn.session.id;
      let lastError: string | undefined;
      let ending: 'completed' | 'failed' | undefined;
      for (const line of output.split('\n').filter(Boolean)) {
        const event = yield* Schema.decodeUnknownEffect(
          Schema.fromJsonString(eventSchema),
        )(line).pipe(
          Effect.mapError(() =>
            failure('unusable_output', turn.wording.unusable),
          ),
        );
        if (event.type === 'turn.failed' || event.type === 'error') {
          const detail = event.error?.message ?? event.message;
          if (detail) lastError = detail;
        }
        if (event.type === 'turn.failed') ending = 'failed';
        if (event.type === 'turn.completed') ending = 'completed';
        if (event.type === 'thread.started' && event.thread_id)
          sessionId = event.thread_id;
      }
      const schema = turn.schema;
      const answer = yield* readBoundedText(answerPath, 4 * 1024 * 1024).pipe(
        Effect.provideService(FileSystem.FileSystem, fs),
        Effect.flatMap((text) =>
          schema === undefined
            ? Effect.succeed(text)
            : Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown))(
                text,
              ),
        ),
        Effect.result,
      );
      if (
        ending === 'failed' ||
        (lastError !== undefined && ending !== 'completed') ||
        answer._tag === 'Failure' ||
        (typeof answer.success === 'string' && answer.success.trim() === '')
      ) {
        if (lastError === undefined)
          return yield* failure('unusable_output', turn.wording.unusable);
        const error =
          /invalid_request_error|invalid_json_schema|invalid schema/i.test(
            lastError,
          )
            ? providerFailure(turn.provider, lastError, turn.wording.stopped)
            : signedOutOutput.test(lastError)
              ? failure(
                  'signed_out',
                  'Sign in again to the selected agent CLI.',
                )
              : modelRefused(lastError)
                ? unavailableWriter(turn)
                : providerFailure(
                    turn.provider,
                    lastError,
                    turn.wording.stopped,
                  );
        yield* logProviderFailure(error, lastError);
        return yield* error;
      }
      return {
        sessionId,
        costUsd: undefined,
        output: answer.success,
      } satisfies AgentTurnResult;
    });
    return { run };
  });
