import { readActionFile } from './read-action-file.ts';
import { Effect } from 'effect';
import type { ActionFailure, ActionPlatform } from '../dtos/action-failure.ts';
import { readActionCommand } from './read-action-command.ts';
import { GitActionRejectedError } from '../../shared/errors/git-action-rejected-error.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';

export const rejectBusyCheckout = Effect.fn('Git.rejectBusyCheckout')(
  function* (
    process: GitProcessRunner,
    allowMerge = false,
    ignoreIndexLock = false,
  ): Effect.fn.Return<'merge' | null, ActionFailure, ActionPlatform> {
    let merge = false;
    for (const name of [
      'MERGE_HEAD',
      'CHERRY_PICK_HEAD',
      'REVERT_HEAD',
      'rebase-merge',
      'rebase-apply',
      'sequencer',
      'index.lock',
    ]) {
      const path = (yield* readActionCommand(process, [
        'rev-parse',
        '--path-format=absolute',
        '--git-path',
        name,
      ])).trimEnd();
      if ((yield* readActionFile(path)) === null) continue;
      if (name === 'MERGE_HEAD' && allowMerge) {
        merge = true;
        continue;
      }
      if (name === 'index.lock' && ignoreIndexLock) continue;
      return yield* new GitActionRejectedError({ reason: 'CHECKOUT_BUSY' });
    }
    return merge ? 'merge' : null;
  },
);
