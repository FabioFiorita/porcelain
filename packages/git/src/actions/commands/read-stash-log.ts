import { STASH_LIST_ARGS } from '../../shared/parsers/refs.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { readActionCommand } from './read-action-command.ts';

export function readStashLog(
  process: GitProcessRunner,
  signal: AbortSignal,
): Promise<string> {
  return readActionCommand(process, STASH_LIST_ARGS, signal);
}
