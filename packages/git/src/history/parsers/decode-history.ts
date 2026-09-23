import { UnsupportedHistoryDataError } from '../errors/unsupported-history-data-error.ts';

export function decodeHistory(output: Buffer): string {
  try {
    return new TextDecoder('utf8', { fatal: true }).decode(output);
  } catch (cause) {
    throw new UnsupportedHistoryDataError({ cause });
  }
}
