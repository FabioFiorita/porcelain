import { FILE_QUICK_OPEN_MAX } from '@/config/limits';
import { matchingFilePaths } from '@porcelain/client/files/rules';

export function quickOpenMatches(paths: readonly string[], query: string) {
  return matchingFilePaths(paths, query).slice(0, FILE_QUICK_OPEN_MAX);
}
