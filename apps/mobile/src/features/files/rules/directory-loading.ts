import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';

export function directoryLoading(
  paths: readonly string[],
  results: readonly AsyncResult.AsyncResult<unknown, unknown>[],
): { initialRoot: boolean; folders: ReadonlySet<string> } {
  let initialRoot = false;
  const folders = new Set<string>();
  paths.forEach((path, index) => {
    const result = results[index];
    if (!result || (!AsyncResult.isInitial(result) && !result.waiting)) return;
    if (path) folders.add(path);
    else initialRoot = Option.isNone(AsyncResult.value(result));
  });
  return { initialRoot, folders };
}
