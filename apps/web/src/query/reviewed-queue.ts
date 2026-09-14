import type { QueryClient } from '@tanstack/react-query';
import type {
  EvidenceResponse,
  ReviewedMarksResponse,
  ReviewSummary,
} from '../domain/review';

type Intent = { path: string; fingerprint?: string; reviewedAt: string };
type Queue = {
  tail: Promise<void>;
  confirmed: ReviewedMarksResponse | undefined;
  pending: Intent[];
};
const queues = new WeakMap<object, Map<string, Queue>>();

export function enqueueReviewed(
  context: {
    connection: { controller: AbortController };
    key: readonly unknown[];
  },
  client: QueryClient,
  change: { path: string; fingerprint?: string },
  operation: () => Promise<ReviewedMarksResponse>,
) {
  const signal = context.connection.controller.signal;
  signal.throwIfAborted();
  let entries = queues.get(context.connection);
  if (!entries) {
    entries = new Map();
    queues.set(context.connection, entries);
  }
  const hash = JSON.stringify(context.key);
  let queue = entries.get(hash);
  if (!queue) {
    queue = {
      tail: Promise.resolve(),
      confirmed: client.getQueryData(context.key),
      pending: [],
    };
    entries.set(hash, queue);
  }
  const current = queue;
  const intent: Intent = { ...change, reviewedAt: new Date().toISOString() };
  current.pending.push(intent);
  const prefix = context.key.slice(0, -1);
  const summaryKey = [...prefix, 'summary'];
  const publish = () => {
    if (signal.aborted || !current.confirmed) return;
    const marks = new Map(
      current.confirmed.marks.map((mark) => [mark.path, mark]),
    );
    for (const pending of current.pending) {
      if (pending.fingerprint)
        marks.set(pending.path, {
          path: pending.path,
          fingerprint: pending.fingerprint,
          reviewedAt: pending.reviewedAt,
        });
      else marks.delete(pending.path);
    }
    client.setQueryData(context.key, {
      ...current.confirmed,
      marks: [...marks.values()],
    });
    const evidence = client.getQueryData<EvidenceResponse>([
      ...prefix,
      'evidence',
    ]);
    if (evidence)
      client.setQueryData<ReviewSummary>(summaryKey, (summary) =>
        summary
          ? {
              ...summary,
              pendingFiles: evidence.evidence.filter(
                (entry) =>
                  entry.fingerprint === null ||
                  marks.get(entry.path)?.fingerprint !== entry.fingerprint,
              ).length,
            }
          : undefined,
      );
  };
  const ready = Promise.all([
    client.cancelQueries({ queryKey: context.key, exact: true }),
    client.cancelQueries({ queryKey: summaryKey, exact: true }),
  ]).then(publish);
  // Keep newer optimistic intents on top of every confirmed server snapshot.
  const result = current.tail.then(async () => {
    await ready;
    try {
      const response = await operation();
      current.confirmed = response;
      return response;
    } finally {
      if (!signal.aborted)
        await Promise.all([
          client.cancelQueries({ queryKey: context.key, exact: true }),
          client.cancelQueries({ queryKey: summaryKey, exact: true }),
        ]);
      current.pending = current.pending.filter((pending) => pending !== intent);
      publish();
    }
  });
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  current.tail = tail;
  void tail.then(() => {
    if (current.tail !== tail) return;
    entries.delete(hash);
    if (signal.aborted) return;
    void client.invalidateQueries({
      queryKey: summaryKey,
      exact: true,
      refetchType:
        client.getQueryData(summaryKey) &&
        client.getQueryData([...prefix, 'evidence'])
          ? 'none'
          : 'active',
    });
  });
  return result;
}
