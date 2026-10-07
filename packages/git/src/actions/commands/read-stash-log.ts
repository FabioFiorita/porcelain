import { STASH_LIST_ARGS } from '../../shared/parsers/refs.ts';
import { Effect } from 'effect';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { readActionCommand } from './read-action-command.ts';

export const readStashLog = Effect.fn('Git.readStashLog')(
  (process: GitProcessRunner) => readActionCommand(process, STASH_LIST_ARGS),
);
