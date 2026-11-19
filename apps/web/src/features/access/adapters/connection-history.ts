import { liveDiagnosticSchema } from '@porcelain/client/live';
import { Option, Schema } from 'effect';

export const connectionHistoryKey = 'porcelain.connection-history';
export const connectionHistoryLimit = 100;
export const connectionHistoryLocks = globalThis.navigator?.locks;

function historyStorage() {
  return connectionHistoryLocks ? localStorage : sessionStorage;
}

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
    const saved = historyStorage().getItem(connectionHistoryKey);
    return saved === null
      ? []
      : (Option.getOrUndefined(decodeHistory(saved))?.slice(
          -connectionHistoryLimit,
        ) ?? []);
  } catch {
    return undefined;
  }
}

export function writeConnectionHistory(entries: readonly HistoryEntry[]) {
  try {
    historyStorage().setItem(connectionHistoryKey, JSON.stringify(entries));
    return true;
  } catch {
    return false;
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
