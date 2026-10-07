import type { gitActionCommands } from './git-action-controller.ts';
import { Effect } from 'effect';
import type { Expectation } from '../rules/git-action.ts';
import {
  gitErrorMessage,
  type GitNotice,
  receiptFailed,
  receiptWords,
} from '../rules/feedback.ts';

export const restoreStash = Effect.fn('GitActions.restoreStash')(function* (
  restore: Pick<ReturnType<typeof gitActionCommands>, 'run'>,
  stash: { stashOid: string; restoreIndex: boolean },
  expected: Expectation,
  notify: (notice: GitNotice) => void,
  words: { restored: string; failed: string },
) {
  const failure = yield* restore
    .run({ action: 'stash-apply', ...stash }, expected)
    .pipe(
      Effect.map((receipt) =>
        receiptFailed(receipt) ? receiptWords(receipt) : null,
      ),
      Effect.catch((error) => Effect.succeed(gitErrorMessage(error))),
    );
  notify(
    failure === null
      ? { title: words.restored, type: 'success' }
      : { title: words.failed, description: failure, type: 'error' },
  );
});
