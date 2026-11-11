import type { ChildProcess } from 'node:child_process';

const STOP_TIMEOUT_MS = 10_000;

export class IsolatedProcess {
  readonly child: ChildProcess;
  readonly exited: Promise<void>;
  private readonly result: Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>;
  private readonly deadline: (expired: () => void) => () => void;
  private stopping: Promise<void> | undefined;

  constructor(
    child: ChildProcess,
    deadline: (expired: () => void) => () => void = (expired) => {
      const timer = setTimeout(expired, STOP_TIMEOUT_MS);
      return () => clearTimeout(timer);
    },
  ) {
    this.child = child;
    this.deadline = deadline;
    this.result = new Promise((resolve) =>
      child.once('close', (code, signal) => resolve({ code, signal })),
    );
    this.exited = this.result.then(() => undefined);
  }

  stop(): Promise<void> {
    return (this.stopping ??= this.shutDown());
  }

  private async shutDown(): Promise<void> {
    this.child.kill('SIGTERM');
    let cancelDeadline: (() => void) | undefined;
    const result = await Promise.race([
      this.result,
      new Promise<never>((_resolve, reject) => {
        cancelDeadline = this.deadline(() =>
          reject(new Error('Isolated server did not stop within 10 seconds')),
        );
      }),
    ])
      .catch(async (error: unknown) => {
        this.child.kill('SIGKILL');
        await this.exited;
        throw error;
      })
      .finally(() => {
        cancelDeadline?.();
      });
    if (result.code !== 0)
      throw new Error(
        `Isolated server exited with ${result.signal ?? `code ${result.code}`} during shutdown`,
      );
  }
}
