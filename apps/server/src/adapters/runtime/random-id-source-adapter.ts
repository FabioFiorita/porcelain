import { randomUUID } from 'node:crypto';

export class RandomIdSourceAdapter {
  next(): string {
    return randomUUID();
  }
}
