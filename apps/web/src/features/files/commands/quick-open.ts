import { useQuickOpenQuery } from '../store';

export function useQuickOpenActions(
  onOpen: (path: string) => void,
  overlay: { toggle: () => void; close: () => void },
) {
  const { query, setQuery } = useQuickOpenQuery();
  return {
    query,
    setQuery,
    toggle: overlay.toggle,
    select: (path: string) => {
      overlay.close();
      setQuery('');
      onOpen(path);
    },
  };
}
