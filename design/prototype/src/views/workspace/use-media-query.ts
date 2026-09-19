import { useCallback, useSyncExternalStore } from 'react';

/** apps/web's `useIsMobile` breakpoint (768px): below it the projects navigator floats over the document. */
export const PHONE_QUERY = '(max-width: 767px)';

/** apps/web's review workspace: from here up the review sidebar is a column, below it a slide-over. */
export const WIDE_QUERY = '(min-width: 1280px)';

/** Whether a media query matches now, following the window as it resizes. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
  );
}
