import { readFileSync } from 'node:fs';

export function fixture(name: string): Buffer {
  return readFileSync(new URL(name, import.meta.url));
}
