/**
 * Lets identical reads that are already in flight share one answer.
 *
 * The work belongs to the group, not to whichever caller arrived first: it has
 * its own signal, so one caller leaving never cancels the read another is
 * waiting for. Nothing is kept once it settles, so this shares work in
 * progress rather than caching answers.
 *
 * Only callers with the same latency expectation share the same key, so a
 * read nobody is waiting on cannot capture one somebody is: attaching to a
 * slow read would hand its wait to a request that would otherwise have been
 * answered.
 */
type Group<T> = {
  readonly controller: AbortController;
  readonly result: Promise<T>;
  subscribers: number;
};

export class SharedReads {
  private readonly groups = new Map<string, Group<unknown>>();

  /** How many reads are in flight; for tests and tooling. */
  get size() {
    return this.groups.size;
  }

  /**
   * `key` must contain every input that can change the answer, and a caller
   * may only join a group it would be allowed to run itself.
   */
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
        if (this.groups.get(key) === (group as Group<unknown>))
          this.groups.delete(key);
      });
    this.groups.set(key, group as Group<unknown>);
    return group;
  }

  private attach<T>(
    key: string,
    group: Group<T>,
    callerSignal?: AbortSignal,
  ): Promise<T> {
    const leave = () => {
      group.subscribers -= 1;
      // The work exists for its callers; with none left it has no reason to run.
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
