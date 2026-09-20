import { HistorySnapshotUnavailableError } from '../errors/history-snapshot-unavailable-error.ts';
import { readHistory } from '../read-history.ts';

function absentRef(error: unknown): null {
  if (
    error instanceof HistorySnapshotUnavailableError &&
    error.cause instanceof Error &&
    error.cause.cause instanceof Error &&
    'code' in error.cause.cause &&
    error.cause.cause.code === 1
  )
    return null;
  throw error;
}

export async function readOptionalHistoryRef(
  checkout: string,
  args: string[],
  signal?: AbortSignal,
) {
  try {
    return await readHistory(checkout, args, signal);
  } catch (error) {
    return absentRef(error);
  }
}
