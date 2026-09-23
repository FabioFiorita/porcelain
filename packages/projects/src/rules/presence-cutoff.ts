export const PRESENCE_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

export function presenceCutoff(now: string): string {
  return new Date(Date.parse(now) - PRESENCE_GRACE_MS).toISOString();
}
