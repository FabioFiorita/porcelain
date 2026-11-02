import { Effect, Schema } from 'effect';
import { ChildProcessSpawner } from 'effect/process';
import { runCommand, type ProcessGroupLimits } from '@porcelain/process';

class T3SessionCommandError extends Schema.TaggedError<T3SessionCommandError>()(
  'T3SessionCommandError',
  {},
) {}

export const captureT3Session = Effect.fn('T3Session.capture')(function* () {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  return Effect.fn('T3Session.run')(function* (input: {
    threadId: string;
    operation: { kind: 'read' } | { kind: 'send'; message: string };
    timeoutMs: number;
    maxBytes: number;
    processGroup: ProcessGroupLimits;
  }) {
    const output = yield* Effect.scoped(
      runCommand({
        command: 't3',
        args:
          input.operation.kind === 'read'
            ? ['thread', 'show', input.threadId, '--messages', '0', '--json']
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
      return yield* Effect.fail(new T3SessionCommandError());
    return output.stdout.toString('utf8');
  });
});
