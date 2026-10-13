import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';

export function directoryLoading(
  reads: readonly {
    path: string;
    result: AsyncResult.AsyncResult<unknown, unknown>;
  }[],
): { rootLoaded: boolean; initialRoot: boolean; folders: ReadonlySet<string> } {
  let rootLoaded = false;
  let initialRoot = false;
  const folders = new Set<string>();
  for (const { path, result } of reads) {
    const hasValue = Option.isSome(AsyncResult.value(result));
    if (!path && hasValue) rootLoaded = true;
    if ((!AsyncResult.isInitial(result) && !result.waiting) || hasValue)
      continue;
    if (path) folders.add(path);
    else initialRoot = true;
  }
  return { rootLoaded, initialRoot, folders };
}
