import { useState } from 'react';

/**
 * The same array back while its items are the same objects. Pierre re-renders a
 * block's annotations whenever it is handed a new array, which would remount an
 * open composer (and lose what is typed) on every unrelated re-render.
 */
export function useShallowStable<T>(list: readonly T[]): readonly T[] {
  const [stable, setStable] = useState(list);
  const same =
    stable.length === list.length &&
    stable.every((item, index) => item === list[index]);
  if (!same) {
    // State adjusted while rendering: the next render returns this list.
    setStable(list);
    return list;
  }
  return stable;
}
