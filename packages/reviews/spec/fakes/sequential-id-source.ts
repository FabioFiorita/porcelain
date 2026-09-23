import type { IdSource } from '../../src/ports/id-source.ts';

export class SequentialIdSource implements IdSource {
  private issued = 0;

  next(): string {
    this.issued += 1;
    return `00000000-0000-4000-8000-${String(this.issued).padStart(12, '0')}`;
  }
}
