import type { InstantSource } from '@porcelain/reviews/ports';

export class DateInstantSource implements InstantSource {
  after(input: { instant: string; milliseconds: number }): string {
    return new Date(
      Date.parse(input.instant) + input.milliseconds,
    ).toISOString();
  }
}
