import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';

export function directoryLoading(
  reads: readonly {
    path: string;
    result: AsyncResult.AsyncResult<unknown, unknown>;
  }[],
): { rootLoaded: boolean; initialRoot: boolean } {
  const root = reads.find(({ path }) => !path)?.result;
  if (!root) return { rootLoaded: false, initialRoot: false };
  const rootLoaded = Option.isSome(AsyncResult.value(root));
  return {
    rootLoaded,
    initialRoot: !rootLoaded && (AsyncResult.isInitial(root) || root.waiting),
  };
}
