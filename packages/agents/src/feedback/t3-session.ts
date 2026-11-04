import { findExecutable } from '../shared/commands/find-executable.ts';
import { Effect, FileSystem, Path, Schema } from 'effect';
import { ChildProcessSpawner } from 'effect/process';
import { runCommand, type ProcessGroupLimits } from '@porcelain/process';

class T3SessionCommandError extends Schema.TaggedError<T3SessionCommandError>()(
  'T3SessionCommandError',
  {
    reason: Schema.Literals(['command-missing', 'deadline', 'command-failed']),
  },
) {}

export const captureT3Session = Effect.fn('T3Session.capture')(function* () {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return Effect.fn('T3Session.run')(function* (input: {
    threadId: string;
    operation:
      | { kind: 'read' }
      | { kind: 'project-threads'; path: string }
      | { kind: 'send'; message: string };
    timeoutMs: number;
    maxBytes: number;
    processGroup: ProcessGroupLimits;
  }) {
    const command = yield* findExecutable('t3').pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provideService(Path.Path, path),
    );
    if (command === undefined)
      return yield* new T3SessionCommandError({ reason: 'command-missing' });
    const output = yield* Effect.scoped(
      runCommand({
        command,
        args:
          input.operation.kind === 'read'
            ? ['thread', 'show', input.threadId, '--messages', '0', '--json']
            : input.operation.kind === 'project-threads'
              ? ['thread', 'list', '--project', input.operation.path, '--json']
              : ['thread', 'send', input.threadId, '-', '--json'],
        stdin:
          input.operation.kind === 'send' ? input.operation.message : undefined,
        timeoutMs: input.timeoutMs,
        maxBytes: input.maxBytes,
        processGroup: input.processGroup,
      }).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
      ),
    );
    if (
      output.exitCode !== 0 ||
      !output.groupStopped ||
      (output.stopped !== undefined && output.stopped !== 'lingering')
    )
      return yield* Effect.fail(
        new T3SessionCommandError({
          reason: output.stopped === 'deadline' ? 'deadline' : 'command-failed',
        }),
      );
    return output.stdout.toString('utf8');
  });
});
