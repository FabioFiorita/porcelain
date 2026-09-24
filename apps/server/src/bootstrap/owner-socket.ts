import { chmodSync, statSync } from 'node:fs';
import { OwnerSocketModeError } from './errors/owner-socket-mode-error.ts';

export function restrictOwnerSocket(path: string): void {
  chmodSync(path, 0o600);
  const mode = statSync(path).mode & 0o777;
  if (mode !== 0o600) throw new OwnerSocketModeError(path, mode);
}
