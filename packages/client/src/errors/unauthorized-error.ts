import { ConnectionError } from './connection-error.ts';

export class UnauthorizedError extends ConnectionError {
  constructor(options?: ErrorOptions) {
    super('This browser is no longer paired with Porcelain.', options);
    this.name = 'UnauthorizedError';
  }
}
