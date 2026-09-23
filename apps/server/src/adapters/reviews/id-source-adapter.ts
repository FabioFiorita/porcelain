import { randomUUID } from 'node:crypto';
import type { IdSource } from '@porcelain/reviews/ports';

export class IdSourceAdapter implements IdSource {
  next(): string {
    return randomUUID();
  }
}
