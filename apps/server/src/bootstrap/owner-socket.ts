import { chmodSync, statSync } from 'node:fs';

export function restrictOwnerSocket(path: string): void {
  chmodSync(path, 0o600);
  const mode = statSync(path).mode & 0o777;
  if (mode !== 0o600)
    throw new Error(
      `The owner socket ${path} has mode ${mode.toString(8).padStart(3, '0')} instead of 600.`,
    );
}
