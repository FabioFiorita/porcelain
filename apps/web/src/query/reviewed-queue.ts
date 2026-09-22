import type { QueryClient } from '@tanstack/react-query';
import type { ReviewedMarksResponse } from '../domain/review';

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
  return enqueueReviewedOperation(context, client, [change], operation);
}

export function enqueueReviewedMany<T extends ReviewedMarksResponse>(
  context: {
    connection: { controller: AbortController };
    key: readonly unknown[];
  },
  client: QueryClient,
  changes: readonly { path: string; fingerprint?: string }[],
  operation: () => Promise<T>,
) {
  return enqueueReviewedOperation(context, client, changes, operation);
}

function enqueueReviewedOperation<T extends ReviewedMarksResponse>(
  context: {
    connection: { controller: AbortController };
    key: readonly unknown[];
  },
  client: QueryClient,
  changes: readonly { path: string; fingerprint?: string }[],
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
  // Keep newer optimistic intents on top of every confirmed server snapshot.
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
