import { useAtomValue } from '@effect/atom-react';
import { mediaQuery } from '@/shared/store';

export function useDesktopReview() {
  return useAtomValue(mediaQuery('(min-width: 1280px)'));
}
