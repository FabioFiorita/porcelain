type Group<T> = {
  readonly controller: AbortController;
  readonly result: Promise<T>;
  subscribers: number;
};

export class SharedReads {
  private readonly groups = new Map<string, Group<unknown>>();

  get size() {
    return this.groups.size;
  }

  run<T>(
    key: string,
    work: (signal: AbortSignal) => Promise<T>,
    callerSignal?: AbortSignal,
  ): Promise<T> {
    const existing = this.groups.get(key) as Group<T> | undefined;
    const group = existing ?? this.start(key, work);
    group.subscribers += 1;
    return this.attach(key, group, callerSignal);
  }

  private start<T>(key: string, work: (signal: AbortSignal) => Promise<T>) {
    const controller = new AbortController();
    const group: Group<T> = {
      controller,
      subscribers: 0,
      result: (async () => work(controller.signal))(),
    };
    void group.result
      .catch(() => undefined)
      .finally(() => {
        if (this.groups.get(key) === group) this.groups.delete(key);
      });
    this.groups.set(key, group);
    return group;
  }

  private attach<T>(
    key: string,
    group: Group<T>,
    callerSignal?: AbortSignal,
  ): Promise<T> {
    const leave = () => {
      group.subscribers -= 1;
      if (group.subscribers === 0) {
        this.groups.delete(key);
        group.controller.abort(
          new DOMException('The last caller left', 'AbortError'),
        );
      }
    };
    if (!callerSignal)
      return group.result.then(
        (value) => {
          group.subscribers -= 1;
          return value;
        },
        (cause: unknown) => {
          group.subscribers -= 1;
          throw cause;
        },
      );
    return new Promise<T>((resolve, reject) => {
      const abandon = () => {
        leave();
        reject(callerSignal.reason);
      };
      if (callerSignal.aborted) return abandon();
      callerSignal.addEventListener('abort', abandon, { once: true });
      group.result.then(
        (value) => {
          callerSignal.removeEventListener('abort', abandon);
          group.subscribers -= 1;
          resolve(value);
        },
        (cause: unknown) => {
          callerSignal.removeEventListener('abort', abandon);
          group.subscribers -= 1;
          reject(cause);
        },
      );
    });
  }
}
