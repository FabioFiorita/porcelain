import { appendFile, mkdir, rename, stat } from 'node:fs/promises';
import { join } from 'node:path';

export class ServerLog {
  private readonly directory: string;
  private readonly limitBytes: number;
  private size: number | undefined;
  private writing: Promise<void> = Promise.resolve();

  constructor(directory: string, limitBytes: number) {
    this.directory = directory;
    this.limitBytes = limitBytes;
  }

  append(chunk: Buffer): void {
    this.writing = this.writing.then(() =>
      this.write(chunk).catch((error: unknown) => {
        process.stderr.write(
          `Porcelain: server log not written: ${error instanceof Error ? error.message : 'unknown failure'}\n`,
        );
      }),
    );
  }

  flush(): Promise<void> {
    return this.writing;
  }

  private async write(chunk: Buffer): Promise<void> {
    const current = join(this.directory, 'server.log');
    if (this.size === undefined) {
      await mkdir(this.directory, { recursive: true });
      this.size = await stat(current).then(
        (file) => file.size,
        () => 0,
      );
    }
    const kept = chunk.subarray(Math.max(0, chunk.length - this.limitBytes));
    if (this.size > 0 && this.size + kept.length > this.limitBytes) {
      await rename(current, join(this.directory, 'server.log.1'));
      this.size = 0;
    }
    await appendFile(current, kept, { mode: 0o600 });
    this.size += kept.length;
  }
}
