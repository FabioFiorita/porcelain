import { useAtom } from '@effect/atom-react';
import { Effect, Exit } from 'effect';
import { Atom } from 'effect/reactivity';
import { copyToClipboard } from '../../../shared/adapters/clipboard';

const copyPath = Atom.fn(
  Effect.fn('Projects.copyPath')(function* (path: string) {
    yield* Effect.tryPromise(() => copyToClipboard(path));
  }),
);

export function useCopyPath() {
  const [result, run] = useAtom(copyPath, { mode: 'promiseExit' });
  return {
    result,
    copy: (path: string, onDone?: () => void) => {
      void run(path).then((exit) => {
        if (Exit.isSuccess(exit)) onDone?.();
      });
    },
  };
}
