import { Effect } from 'effect';
import type { ActionFailure, ActionPlatform } from '../dtos/action-failure.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { readActionCommand } from './read-action-command.ts';

export const readActionHead = Effect.fn('Git.readActionHead')(function* (
  process: GitProcessRunner,
): Effect.fn.Return<string, ActionFailure, ActionPlatform> {
  return (yield* readActionCommand(process, [
    'rev-parse',
    '--verify',
    'HEAD',
  ])).trimEnd();
});
