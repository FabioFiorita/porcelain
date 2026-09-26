export function summaryMessage(token: string, expires: string): string {
  return `${token}\0${expires}`;
}

export function summaryExpired(expires: string, now: string): boolean {
  return !(Date.parse(expires) >= Date.parse(now));
}
