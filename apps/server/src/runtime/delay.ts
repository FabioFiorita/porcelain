import { setTimeout as wait } from 'node:timers/promises';

export function delay(ms: number): Promise<void> {
  return wait(ms);
}
