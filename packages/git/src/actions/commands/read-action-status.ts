import { Effect } from 'effect';
import type { ActionFailure, ActionPlatform } from '../dtos/action-failure.ts';
import {
  type GitChange,
  parseGitStatusEffect,
} from '../../inspection/index.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { readActionCommand } from './read-action-command.ts';

export const readActionStatus = Effect.fn('Git.readActionStatus')(function* (
  process: GitProcessRunner,
): Effect.fn.Return<GitChange[], ActionFailure, ActionPlatform> {
  const output = yield* readActionCommand(process, [
    'status',
    '--porcelain=v2',
    '-z',
    '--branch',
    '--no-ahead-behind',
    '--untracked-files=all',
    '--find-renames',
  ]);
  return (yield* parseGitStatusEffect(Buffer.from(output), process.limits))
    .changes;
});
