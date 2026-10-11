import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';

export function directoryLoading(
  reads: readonly {
    path: string;
    result: AsyncResult.AsyncResult<unknown, unknown>;
  }[],
): { initialRoot: boolean; folders: ReadonlySet<string> } {
  let initialRoot = false;
  const folders = new Set<string>();
  for (const { path, result } of reads) {
    if (
      (!AsyncResult.isInitial(result) && !result.waiting) ||
      Option.isSome(AsyncResult.value(result))
    )
      continue;
    if (path) folders.add(path);
    else initialRoot = true;
  }
  return { initialRoot, folders };
}
