import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Clock, Effect, FileSystem, Layer, Schema } from 'effect';
import { ChildProcessSpawner } from 'effect/process';
import { runProvider } from '../commit-planning/commands/run-provider.ts';
import { readBoundedText } from '../commit-planning/commands/read-bounded-text.ts';
import { WalkthroughWriter } from '@porcelain/walkthroughs/ports';
import { walkthroughContentSchema } from '@porcelain/contracts/walkthroughs';
import { WalkthroughFailedError } from '@porcelain/walkthroughs/errors';
import type { ProcessGroupLimits } from '@porcelain/process';
import { firstPassSchema, writingPrompts } from './writing-prompts.ts';

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
});
const failure = (kind: WalkthroughFailedError['kind'], message: string) =>
  new WalkthroughFailedError({ kind, message });
export const cliWalkthroughWriterLayer = (options: {
  processGroup: ProcessGroupLimits;
  command?: string;
  deadlineMs?: number;
}) =>
  Layer.effect(
    WalkthroughWriter,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      return WalkthroughWriter.of({
        write: Effect.fn('WalkthroughWriter.write')(
          function* (input) {
            const started = yield* Clock.currentTimeMillis;
            const folder = yield* Effect.acquireRelease(
              Effect.tryPromise(() =>
                mkdtemp(join(tmpdir(), 'porcelain-walkthrough-')),
              ),
              (path) =>
                Effect.promise(() =>
                  rm(path, { recursive: true, force: true }),
                ),
            );
            const images: string[] = [];
            for (const asset of input.evidence.assets) {
              const path = join(
                folder,
                `${asset.id}.${asset.mediaType.split('/')[1] ?? 'png'}`,
              );
              yield* Effect.tryPromise(() => writeFile(path, asset.bytes));
              images.push(path);
            }
            const prompts = writingPrompts(
              input,
              input.evidence,
              input.transcript,
              input.evidence.assets
                .map(
                  (asset, index) =>
                    `- assetId ${asset.id}, file ${images[index]}: ${asset.caption}`,
                )
                .join('\n'),
            );
            let sessionId = input.run.sessionId ?? randomUUID();
            let costUsd: number | undefined = undefined;
            let answer: unknown;
            for (let pass = 0; pass < 2; pass++) {
              const schema = Schema.toJsonSchemaDocument(
                pass === 0 ? firstPassSchema : walkthroughContentSchema,
              ).schema;
              const schemaPath = join(folder, `schema-${pass}.json`);
              const answerPath = join(folder, `answer-${pass}.json`);
              yield* Effect.tryPromise(() =>
                writeFile(schemaPath, JSON.stringify(schema)),
              );
              const claudeArgs = [
                '-p',
                '--model',
                input.run.writer.model,
                '--effort',
                'high',
                '--output-format',
                'json',
                '--json-schema',
                JSON.stringify(schema),
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
                pass === 0 && input.run.sessionId === undefined
                  ? '--session-id'
                  : '--resume',
                sessionId,
              ];
              if (images.length) claudeArgs.push('--add-dir', folder);
              const codexArgs =
                pass === 0
                  ? ['exec', '--sandbox', 'read-only']
                  : ['exec', 'resume', '-c', 'sandbox_mode="read-only"'];
              codexArgs.push(
                '-c',
                'features.hooks=false',
                '--ignore-user-config',
                '--ignore-rules',
                '--disable',
                'plugins',
                '--disable',
                'apps',
                '--disable',
                'multi_agent',
                '--json',
                '--model',
                input.run.writer.model,
                '--output-schema',
                schemaPath,
                '--output-last-message',
                answerPath,
              );
              if (pass === 1) codexArgs.push(sessionId);
              codexArgs.push('-');
              if (pass === 1)
                for (const path of images) codexArgs.push('-i', path);
              if (input.run.writer.provider === 'claude')
                yield* input.recordSession(sessionId);
              const output = yield* runProvider({
                command: options.command ?? input.run.writer.provider,
                args:
                  input.run.writer.provider === 'claude'
                    ? claudeArgs
                    : codexArgs,
                cwd: input.worktreePath,
                env: {
                  ...process.env,
                  GIT_NO_LAZY_FETCH: '1',
                  GIT_CONFIG_COUNT: '2',
                  GIT_CONFIG_KEY_0: 'core.hooksPath',
                  GIT_CONFIG_VALUE_0: '/dev/null',
                  GIT_CONFIG_KEY_1: 'core.fsmonitor',
                  GIT_CONFIG_VALUE_1: 'false',
                },
                prompt: pass === 0 ? prompts.first : prompts.second,
                maxBytes: 4 * 1024 * 1024,
                timeoutMs: options.deadlineMs ?? 20 * 60 * 1000,
                processGroup: options.processGroup,
              }).pipe(
                Effect.provideService(
                  ChildProcessSpawner.ChildProcessSpawner,
                  spawner,
                ),
                Effect.mapError((error) => {
                  if (error.reason === 'deadline')
                    return failure(
                      'timed_out',
                      'The walkthrough writer timed out after 20 minutes.',
                    );
                  if (
                    /not logged in|sign.?in|login|authentication|oauth|token.*expired|unauthorized/i.test(
                      error.detail ?? '',
                    )
                  )
                    return failure(
                      'signed_out',
                      'Sign in again to the selected agent CLI, then try again.',
                    );
                  if (error.cause !== undefined)
                    return failure(
                      'agent_not_installed',
                      'The selected agent CLI could not be started. Check that it is installed.',
                    );
                  return failure(
                    'other',
                    'The selected agent CLI stopped before finishing the walkthrough.',
                  );
                }),
              );
              if (input.run.writer.provider === 'claude') {
                const envelope = yield* Schema.decodeUnknownEffect(
                  Schema.fromJsonString(envelopeSchema),
                )(output).pipe(
                  Effect.mapError(() =>
                    failure(
                      'unusable_output',
                      'The writer returned an unusable response.',
                    ),
                  ),
                );
                if (envelope.is_error)
                  return yield* failure(
                    /sign.?in|login|oauth|token.*expired|unauthorized/i.test(
                      envelope.result ?? '',
                    )
                      ? 'signed_out'
                      : 'other',
                    /sign.?in|login|oauth|token.*expired|unauthorized/i.test(
                      envelope.result ?? '',
                    )
                      ? 'Sign in again to the selected agent CLI.'
                      : 'The selected agent CLI could not finish the walkthrough.',
                  );
                sessionId = envelope.session_id ?? sessionId;
                if (envelope.total_cost_usd !== undefined)
                  costUsd = (costUsd ?? 0) + envelope.total_cost_usd;
                answer = envelope.structured_output;
              } else {
                for (const line of output.split('\n').filter(Boolean)) {
                  const event = yield* Schema.decodeUnknownEffect(
                    Schema.fromJsonString(eventSchema),
                  )(line).pipe(
                    Effect.mapError(() =>
                      failure(
                        'unusable_output',
                        'The writer returned an unusable event.',
                      ),
                    ),
                  );
                  if (event.type === 'thread.started' && event.thread_id)
                    sessionId = event.thread_id;
                }
                const text = yield* readBoundedText(
                  answerPath,
                  4 * 1024 * 1024,
                ).pipe(Effect.provideService(FileSystem.FileSystem, fs));
                answer = yield* Schema.decodeUnknownEffect(
                  Schema.fromJsonString(Schema.Unknown),
                )(text);
              }
              yield* input.recordSession(sessionId);
              if (pass === 0)
                yield* Schema.decodeUnknownEffect(firstPassSchema)(answer);
            }
            const content = yield* Schema.decodeUnknownEffect(
              walkthroughContentSchema,
            )(answer);
            if (
              content.outcome === 'needs_you' &&
              !content.stops.some((stop) => stop.attention !== undefined)
            )
              return yield* failure(
                'unusable_output',
                'The writer requested a decision without giving a question.',
              );
            return {
              content,
              sessionId,
              durationMs: (yield* Clock.currentTimeMillis) - started,
              costUsd,
            };
          },
          Effect.scoped,
          Effect.mapError((error) =>
            error instanceof WalkthroughFailedError
              ? error
              : failure(
                  'unusable_output',
                  'The writer could not produce a usable walkthrough.',
                ),
          ),
        ),
      });
    }),
  );
