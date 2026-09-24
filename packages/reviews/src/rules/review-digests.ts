export function summaryMessage(token: string, expires: string): string {
  return `${token}\0${expires}`;
}

export function summaryExpired(expires: string, now: string): boolean {
  return !(Date.parse(expires) >= Date.parse(now));
}

export function summaryUrl(
  token: string,
  expires: string,
  signature: string,
): string {
  return `/review-summaries/${encodeURIComponent(token)}?expires=${encodeURIComponent(expires)}&signature=${encodeURIComponent(signature)}`;
}
