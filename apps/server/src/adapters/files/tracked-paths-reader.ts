import type { TrackedPathsReader } from '@porcelain/files/ports';
import { InspectionLimitError } from '@porcelain/git/inspection';

export type TrackedPaths = (
  checkout: string,
  signal?: AbortSignal,
) => Promise<{ paths: string[]; complete: boolean }>;

export function createTrackedPathsReader(
  tracked: TrackedPaths,
): TrackedPathsReader {
  return {
    list: async (checkout, signal) => {
      try {
        return await tracked(checkout, signal);
      } catch (error) {
        if (error instanceof InspectionLimitError)
          return { paths: [], complete: false };
        throw error;
      }
    },
  };
}
