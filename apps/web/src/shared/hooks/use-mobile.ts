import { useAtomValue } from '@effect/atom-react';
import { MOBILE_BREAKPOINT_PX } from '@/config/limits';
import { mediaQuery } from '../store';

export function useIsMobile() {
  return useAtomValue(mediaQuery(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`));
}
