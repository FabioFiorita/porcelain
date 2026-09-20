import { useSyncExternalStore } from 'react';

// Hash routes keep deep links working without a router: #/map/changes/changes.status
const read = () =>
  window.location.hash
    .replace(/^#\/?/, '')
    .split('/')
    .filter(Boolean)
    .map(decodeURIComponent);

export function useRoute() {
  const hash = useSyncExternalStore(
    (listener) => {
      window.addEventListener('hashchange', listener);
      return () => window.removeEventListener('hashchange', listener);
    },
    () => window.location.hash,
  );
  void hash;
  return read();
}

export function navigate(...segments: (string | undefined)[]) {
  window.location.hash = `/${segments
    .filter((segment): segment is string => Boolean(segment))
    .map(encodeURIComponent)
    .join('/')}`;
}

export const href = (...segments: string[]) =>
  `#/${segments.map(encodeURIComponent).join('/')}`;
