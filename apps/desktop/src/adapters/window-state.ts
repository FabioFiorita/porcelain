import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  desktopWindowStateSchema,
  type DesktopWindowState,
} from '@porcelain/contracts/desktop';

export class WindowState {
  private readonly profile: string;

  constructor(profile: string) {
    this.profile = profile;
  }

  read(): DesktopWindowState | undefined {
    try {
      const value: unknown = JSON.parse(
        readFileSync(join(this.profile, 'window.json'), 'utf8'),
      );
      const result = desktopWindowStateSchema.safeParse(value);
      return result.success ? result.data : undefined;
    } catch {
      return undefined;
    }
  }

  write(state: DesktopWindowState): void {
    mkdirSync(this.profile, { recursive: true });
    const destination = join(this.profile, 'window.json');
    const temporary = `${destination}.tmp`;
    writeFileSync(temporary, JSON.stringify(state));
    renameSync(temporary, destination);
  }
}
