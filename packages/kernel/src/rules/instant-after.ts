import * as DateTime from 'effect/DateTime';

export function instantAfter(start: string, lifetimeMs: number): string {
  return DateTime.formatIso(
    DateTime.add(DateTime.makeUnsafe(start), { milliseconds: lifetimeMs }),
  );
}
