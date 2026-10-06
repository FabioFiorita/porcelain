import type { Expectation } from '@porcelain/client/git-actions/rules';
import {
  gitErrorMessage,
  type GitNotice,
  receiptFailed,
  receiptWords,
} from '@porcelain/client/git-actions/rules';
import type { useGitAction } from './run-action';

export async function restoreStash(
  restore: ReturnType<typeof useGitAction>,
  stash: { stashOid: string; restoreIndex: boolean },
  expected: Expectation,
  notify: (notice: GitNotice) => void,
  words: { restored: string; failed: string },
) {
  let failure: string | null;
  try {
    const receipt = await restore.run(
      { action: 'stash-apply', ...stash },
      expected,
    );
    failure = receiptFailed(receipt) ? receiptWords(receipt) : null;
  } catch (error) {
    failure = gitErrorMessage(error);
  }
  notify(
    failure === null
      ? { title: words.restored, type: 'success' }
      : { title: words.failed, description: failure, type: 'error' },
  );
}
