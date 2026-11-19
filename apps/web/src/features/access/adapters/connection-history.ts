import { liveDiagnosticSchema } from '@porcelain/client/live';
import { Option, Schema } from 'effect';

export const connectionHistoryKey = 'porcelain.connection-history';
export const connectionHistoryLimit = 100;

const documentEvent = Schema.Struct({
  at: Schema.Int,
  event: Schema.Literals([
    'Document navigation',
    'Document reload',
    'Document back/forward navigation',
    'Network online',
    'Network offline',
  ]),
});
const historyEntry = Schema.Struct({
  document: Schema.Int,
  environmentId: Schema.optional(Schema.String),
  diagnostic: Schema.Union([liveDiagnosticSchema, documentEvent]),
});
const decodeHistory = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.Array(historyEntry)),
);
export type HistoryEntry = typeof historyEntry.Type;

export function readConnectionHistory() {
  try {
    const saved = localStorage.getItem(connectionHistoryKey);
    if (saved !== null)
      return Option.getOrUndefined(decodeHistory(saved))?.slice(
        -connectionHistoryLimit,
      );
  } catch {
    return undefined;
  }
  return undefined;
}

export function writeConnectionHistory(entries: readonly HistoryEntry[]) {
  try {
    localStorage.setItem(connectionHistoryKey, JSON.stringify(entries));
  } catch {
    return;
  }
}

export const documentStartedAt = Math.floor(performance.timeOrigin);

export function currentDocumentEntry(): HistoryEntry {
  const navigation = performance
    .getEntriesByType('navigation')
    .find((entry): entry is PerformanceNavigationTiming => 'type' in entry);
  return {
    document: documentStartedAt,
    diagnostic: {
      at: documentStartedAt,
      event:
        navigation?.type === 'reload'
          ? 'Document reload'
          : navigation?.type === 'back_forward'
            ? 'Document back/forward navigation'
            : 'Document navigation',
    },
  };
}
