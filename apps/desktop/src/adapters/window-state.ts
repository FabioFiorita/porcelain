import { Schema, Result } from 'effect';
import { readFileSync } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import {
  desktopWindowStateSchema,
  type DesktopWindowState,
} from '@porcelain/contracts/desktop';

export class WindowState {
  private readonly profile: string;
  private readonly delayMs: number;
  private latest: DesktopWindowState | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private writing: Promise<void> = Promise.resolve();

  constructor(profile: string, delayMs: number) {
    this.profile = profile;
    this.delayMs = delayMs;
  }

  read(): DesktopWindowState | undefined {
    try {
      const value: unknown = JSON.parse(
        readFileSync(join(this.profile, 'window.json'), 'utf8'),
      );
      const result = Schema.decodeUnknownResult(desktopWindowStateSchema)(
        value,
      );
      return Result.isSuccess(result) ? result.success : undefined;
    } catch {
      return undefined;
    }
  }

  schedule(state: DesktopWindowState): void {
    this.latest = state;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush();
    }, this.delayMs);
  }

  flush(): Promise<void> {
    clearTimeout(this.timer);
    this.timer = undefined;
    const state = this.latest;
    this.latest = undefined;
    if (state !== undefined)
      this.writing = this.writing.then(() =>
        this.write(state).catch((error: unknown) => {
          process.stderr.write(
            `Porcelain: window state not saved: ${error instanceof Error ? error.message : 'unknown failure'}\n`,
          );
        }),
      );
    return this.writing;
  }

  private async write(state: DesktopWindowState): Promise<void> {
    await mkdir(this.profile, { recursive: true });
    const destination = join(this.profile, 'window.json');
    const temporary = `${destination}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(state));
      await rename(temporary, destination);
    } finally {
      await rm(temporary, { force: true });
    }
  }
}
