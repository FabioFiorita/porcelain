import type { ChildProcess } from 'node:child_process';

const STOP_TIMEOUT_MS = 10_000;

export class IsolatedProcess {
  readonly child: ChildProcess;
  readonly exited: Promise<void>;
  private readonly result: Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>;
  private stopping: Promise<void> | undefined;

  constructor(child: ChildProcess) {
    this.child = child;
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
    let timer: NodeJS.Timeout | undefined;
    const result = await Promise.race([
      this.result,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(new Error('Isolated server did not stop within 10 seconds')),
          STOP_TIMEOUT_MS,
        );
      }),
    ])
      .catch(async (error: unknown) => {
        this.child.kill('SIGKILL');
        await this.exited;
        throw error;
      })
      .finally(() => {
        if (timer) clearTimeout(timer);
      });
    if (result.code !== 0)
      throw new Error(
        `Isolated server exited with ${result.signal ?? `code ${result.code}`} during shutdown`,
      );
  }
}
