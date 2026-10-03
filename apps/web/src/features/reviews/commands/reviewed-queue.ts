import type { QueryClient } from '@tanstack/react-query';
import type { ListReviewedFilesResponse } from '@porcelain/contracts/reviews';

type ReviewedMarksResponse = ListReviewedFilesResponse;

type Queue = {
  tail: Promise<void>;
  confirmed: ReviewedMarksResponse | undefined;
  pending: Intent[];
};
type QueueContext = {
  connection: { controller: AbortController };
  key: readonly unknown[];
};
type ReviewedChange = { path: string; fingerprint?: string };
type Intent = ReviewedChange & { reviewedAt: string };
const queues = new WeakMap<object, Map<string, Queue>>();

export function enqueueReviewed(
  context: QueueContext,
  client: QueryClient,
  change: ReviewedChange,
  operation: () => Promise<ReviewedMarksResponse>,
) {
  return enqueueReviewedMany(context, client, [change], operation);
}

export function enqueueReviewedMany<T extends ReviewedMarksResponse>(
  context: QueueContext,
  client: QueryClient,
  changes: readonly ReviewedChange[],
  operation: () => Promise<T>,
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
  const intents: Intent[] = changes.map((change) => ({
    ...change,
    reviewedAt: new Date().toISOString(),
  }));
  current.pending.push(...intents);
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
  };
  const ready = client
    .cancelQueries({ queryKey: context.key, exact: true })
    .then(publish);
  const result = current.tail.then(async () => {
    await ready;
    try {
      const response = await operation();
      current.confirmed = {
        worktreeId: response.worktreeId,
        marks: response.marks,
      };
      return response;
    } finally {
      if (!signal.aborted)
        await client.cancelQueries({ queryKey: context.key, exact: true });
      current.pending = current.pending.filter(
        (pending) => !intents.includes(pending),
      );
      publish();
    }
  });
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  current.tail = tail;
  void tail.then(() => {
    if (current.tail !== tail) entries.delete(hash);
  });
  return result;
}
