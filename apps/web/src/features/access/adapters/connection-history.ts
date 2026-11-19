import { liveDiagnosticSchema } from '@porcelain/client/live';
import { Option, Schema } from 'effect';
import { createId } from '@/shared/lib/id';

const keyPrefix = 'porcelain.connection-history:';
const documentId = createId();
const documentStartedAt = Math.floor(performance.timeOrigin);
const historyLimit = 100;

export function isConnectionHistoryKey(key: string) {
  return key.startsWith(keyPrefix);
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
  documentId: Schema.String,
  environmentId: Schema.optional(Schema.String),
  diagnostic: Schema.Union([liveDiagnosticSchema, documentEvent]),
});
const decodeHistory = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.Array(historyEntry)),
);
export type HistoryEntry = typeof historyEntry.Type;

export function newestConnectionHistory(entries: readonly HistoryEntry[]) {
  return entries
    .toSorted(
      (left, right) =>
        left.diagnostic.at - right.diagnostic.at ||
        left.documentId.localeCompare(right.documentId),
    )
    .slice(-historyLimit);
}

export function readOtherConnectionHistory(prune = false) {
  try {
    const keys = Object.keys(localStorage)
      .filter(isConnectionHistoryKey)
      .sort();
    const documents = new Map<
      string,
      {
        key: string;
        entries: readonly HistoryEntry[];
      }
    >();
    for (const key of keys) {
      const owner = key.slice(keyPrefix.length, key.lastIndexOf(':'));
      const saved = localStorage.getItem(key);
      if (saved === null) continue;
      const entries = Option.getOrUndefined(decodeHistory(saved));
      if (entries) documents.set(owner, { key, entries });
    }
    const recent = newestConnectionHistory(
      [...documents.values()].flatMap(({ entries }) => entries),
    );
    if (prune) {
      const retained = new Set(
        recent.map((entry) => documents.get(entry.documentId)?.key),
      );
      for (const key of keys) {
        if (!retained.has(key)) localStorage.removeItem(key);
      }
    }
    return recent.filter((entry) => entry.documentId !== documentId);
  } catch {
    return undefined;
  }
}

export function writeConnectionHistory(
  revision: number,
  entries: readonly HistoryEntry[],
) {
  try {
    const version = String(revision).padStart(16, '0');
    const key = `${keyPrefix}${documentId}:${version}`;
    localStorage.setItem(key, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

export function connectionHistoryEntry(
  diagnostic: HistoryEntry['diagnostic'],
  environmentId?: string,
): HistoryEntry {
  return { document: documentStartedAt, documentId, diagnostic, environmentId };
}

export function currentDocumentEntry(): HistoryEntry {
  const navigation = performance
    .getEntriesByType('navigation')
    .find((entry): entry is PerformanceNavigationTiming => 'type' in entry);
  return connectionHistoryEntry({
    at: documentStartedAt,
    event:
      navigation?.type === 'reload'
        ? 'Document reload'
        : navigation?.type === 'back_forward'
          ? 'Document back/forward navigation'
          : 'Document navigation',
  });
}
