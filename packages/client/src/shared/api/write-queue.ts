class WriteNotSentError extends Error {
  constructor(cause: unknown) {
    super('An earlier change failed, so this one was not sent.', {
      cause: cause instanceof WriteNotSentError ? cause.cause : cause,
    });
    this.name = 'WriteNotSentError';
  }
}

export function createWriteQueue(onDrained?: () => void) {
  let tail: Promise<unknown> = Promise.resolve();

  return {
    enqueue<T>(operation: () => Promise<T>): Promise<T> {
      const result = tail.then(operation, (cause: unknown) => {
        throw new WriteNotSentError(cause);
      });
      tail = result;
      const finish = () => {
        if (tail !== result) return;
        tail = Promise.resolve();
        onDrained?.();
      };
      void result.then(finish, finish);
      return result;
    },
  };
}

export function createScopedWriteQueues() {
  const owners = new WeakMap<
    object,
    Map<string, ReturnType<typeof createWriteQueue>>
  >();
  return (owner: object, key: readonly unknown[]) => {
    const hash = JSON.stringify(key);
    return {
      enqueue<T>(operation: () => Promise<T>): Promise<T> {
        let queues = owners.get(owner);
        if (!queues) {
          queues = new Map();
          owners.set(owner, queues);
        }
        let queue = queues.get(hash);
        if (!queue) {
          const activeQueues = queues;
          queue = createWriteQueue(() => activeQueues.delete(hash));
          queues.set(hash, queue);
        }
        return queue.enqueue(operation);
      },
    };
  };
}
