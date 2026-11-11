import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Clock, Effect, Layer, Schema } from 'effect';
import {
  WalkthroughModelReader,
  WalkthroughWriter,
} from '@porcelain/walkthroughs/ports';
import { walkthroughContentSchema } from '@porcelain/contracts/walkthroughs';
import type { WalkthroughWriterChoice } from '@porcelain/walkthroughs/models';
import { WalkthroughFailedError } from '@porcelain/walkthroughs/errors';
import type { ProcessGroupLimits } from '@porcelain/process';
import {
  agentTurns,
  failure,
  unavailableWriter,
  type AgentTurnWording,
} from './agent-turn.ts';
import {
  answerPrompts,
  firstPassSchema,
  writingPrompts,
} from './writing-prompts.ts';

const WRITING: AgentTurnWording = {
  timedOut: 'The walkthrough writer timed out after 20 minutes.',
  stopped: 'The selected agent CLI stopped before finishing the walkthrough.',
  unusable: 'The writer returned an unusable response.',
};
const ANSWERING: AgentTurnWording = {
  timedOut: 'The agent took longer than 5 minutes to answer. Ask again.',
  stopped: 'The selected agent CLI stopped before answering. Ask again.',
  unusable: 'The agent returned an unusable answer. Ask again.',
};
const ANSWER_DEADLINE_MS = 5 * 60 * 1000;
const MAX_ANSWER_LENGTH = 8000;
const temporaryFolder = Effect.acquireRelease(
  Effect.tryPromise(() => mkdtemp(join(tmpdir(), 'porcelain-walkthrough-'))),
  (path) => Effect.promise(() => rm(path, { recursive: true, force: true })),
);
const usableAnswer = Effect.fnUntraced(function* (output: unknown) {
  const text = typeof output === 'string' ? output.trim() : '';
  if (text === '' || text.length > MAX_ANSWER_LENGTH)
    return yield* failure('unusable_output', ANSWERING.unusable);
  return text;
});
export const cliWalkthroughWriterLayer = (options: {
  processGroup: ProcessGroupLimits;
  command?: string;
  deadlineMs?: number;
  answerDeadlineMs?: number;
}) =>
  Layer.effect(
    WalkthroughWriter,
    Effect.gen(function* () {
      const turns = yield* agentTurns(options);
      const models = yield* WalkthroughModelReader;
      const validate = Effect.fn('WalkthroughWriter.validate')(function* (
        writer: WalkthroughWriterChoice,
      ) {
        const available = (yield* models.read()).find(
          (model) =>
            model.provider === writer.provider && model.model === writer.model,
        );
        if (!available) return yield* unavailableWriter(writer);
        if (!available.efforts.includes(writer.effort))
          return yield* failure(
            'other',
            `The walkthrough model ${writer.model} does not support ${writer.effort} effort. Choose a supported effort in walkthrough settings.`,
          );
      });
      return WalkthroughWriter.of({
        write: Effect.fn('WalkthroughWriter.write')(
          function* (input) {
            yield* validate(input.run.writer);
            const started = yield* Clock.currentTimeMillis;
            const folder = yield* temporaryFolder;
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
            const { provider, model, effort } = input.run.writer;
            let sessionId = input.run.sessionId ?? randomUUID();
            let costUsd: number | undefined = undefined;
            let answer: unknown;
            for (let pass = 0; pass < 2; pass++) {
              if (provider === 'claude') yield* input.recordSession(sessionId);
              const resumed =
                pass === 1 ||
                (provider === 'claude' && input.run.sessionId !== undefined);
              const turn = yield* turns.run({
                provider,
                model,
                effort,
                worktreePath: input.worktreePath,
                folder,
                session: { kind: resumed ? 'resume' : 'new', id: sessionId },
                label: String(pass),
                schema: pass === 0 ? firstPassSchema : walkthroughContentSchema,
                images,
                prompt: pass === 0 ? prompts.first : prompts.second,
                timeoutMs: options.deadlineMs ?? 20 * 60 * 1000,
                wording: WRITING,
              });
              sessionId = turn.sessionId;
              if (turn.costUsd !== undefined)
                costUsd = (costUsd ?? 0) + turn.costUsd;
              answer = turn.output;
              yield* input.recordSession(sessionId);
              if (pass === 0)
                yield* Schema.decodeUnknownEffect(
                  provider === 'codex'
                    ? Schema.toCodecJson(firstPassSchema)
                    : firstPassSchema,
                )(answer);
            }
            const content = yield* Schema.decodeUnknownEffect(
              provider === 'codex'
                ? Schema.toCodecJson(walkthroughContentSchema)
                : walkthroughContentSchema,
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
        answer: Effect.fn('WalkthroughWriter.answer')(
          function* (input) {
            yield* validate(input.run.writer);
            const started = yield* Clock.currentTimeMillis;
            const folder = yield* temporaryFolder;
            const deadline = options.answerDeadlineMs ?? ANSWER_DEADLINE_MS;
            const prompts = answerPrompts(input);
            const { provider, model, effort } = input.run.writer;
            const ask = (
              session: { kind: 'new' | 'resume'; id: string },
              prompt: string,
              timeoutMs: number,
              label: string,
            ) =>
              turns
                .run({
                  provider,
                  model,
                  effort,
                  worktreePath: input.worktreePath,
                  folder,
                  session,
                  label,
                  schema: undefined,
                  images: [],
                  prompt,
                  timeoutMs,
                  wording: ANSWERING,
                })
                .pipe(
                  Effect.flatMap((turn) =>
                    usableAnswer(turn.output).pipe(
                      Effect.map((text) => ({ ...turn, text })),
                    ),
                  ),
                );
            const finish = (turn: {
              sessionId: string;
              costUsd: number | undefined;
              text: string;
            }) =>
              Clock.currentTimeMillis.pipe(
                Effect.map((now) => ({
                  text: turn.text,
                  sessionId: turn.sessionId,
                  durationMs: now - started,
                  costUsd: turn.costUsd,
                })),
              );
            if (input.run.sessionId !== undefined) {
              const resumed = yield* ask(
                { kind: 'resume', id: input.run.sessionId },
                prompts.resume,
                deadline,
                'resume',
              ).pipe(Effect.result);
              if (resumed._tag === 'Success')
                return yield* finish(resumed.success);
              if (
                resumed.failure instanceof WalkthroughFailedError &&
                !['other', 'unusable_output'].includes(resumed.failure.kind)
              )
                return yield* resumed.failure;
            }
            const elapsed = (yield* Clock.currentTimeMillis) - started;
            return yield* finish(
              yield* ask(
                { kind: 'new', id: randomUUID() },
                prompts.fresh,
                Math.max(deadline - elapsed, 1000),
                'fresh',
              ),
            );
          },
          Effect.scoped,
          Effect.mapError((error) =>
            error instanceof WalkthroughFailedError
              ? error
              : failure('other', ANSWERING.stopped),
          ),
        ),
      });
    }),
  );

export { installedWalkthroughModelReaderLayer } from './installed-walkthrough-model-reader.ts';
