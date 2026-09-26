import { FILE_QUICK_OPEN_MAX } from '@/config/limits';

export function quickOpenMatches(paths: readonly string[], query: string) {
  const needle = query.trim().toLowerCase();
  return paths
    .filter((path) => path.toLowerCase().includes(needle))
    .slice(0, FILE_QUICK_OPEN_MAX);
}
