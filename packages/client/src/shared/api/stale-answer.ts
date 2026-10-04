import { ConnectionError } from './connection-error.ts';

export function assertCurrentAnswer(signal: AbortSignal, matches = true): void {
  signal.throwIfAborted();
  if (!matches)
    throw new ConnectionError(
      'The connected context changed. Reopen Porcelain to continue safely.',
    );
}
