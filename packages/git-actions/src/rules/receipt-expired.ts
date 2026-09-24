export function receiptExpired(
  finishedAt: string,
  now: string,
  retentionMs: number,
): boolean {
  return Date.parse(now) - Date.parse(finishedAt) > retentionMs;
}
