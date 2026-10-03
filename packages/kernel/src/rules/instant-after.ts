export function instantAfter(start: string, lifetimeMs: number): string {
  return new Date(Date.parse(start) + lifetimeMs).toISOString();
}
