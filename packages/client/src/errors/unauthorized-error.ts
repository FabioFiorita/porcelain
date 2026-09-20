import { ConnectionError } from './connection-error.ts';

/**
 * The server no longer accepts this browser's credential: it was revoked, it
 * expired, or the browser never had one.
 *
 * It is its own type because every caller reacts the same way and the reaction
 * belongs in one place — the transport raises it, and the workspace ends the
 * connection rather than each view inventing a message.
 */
export class UnauthorizedError extends ConnectionError {
  constructor(options?: ErrorOptions) {
    super('This browser is no longer paired with Porcelain.', options);
    this.name = 'UnauthorizedError';
  }
}
