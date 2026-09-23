import type { IdSource } from '@porcelain/projects/ports';

export class SequentialIdSource implements IdSource {
  private readonly prefix: string;
  private issued = 0;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  next(): string {
    this.issued += 1;
    return `${this.prefix}-${this.issued}`;
  }
}
