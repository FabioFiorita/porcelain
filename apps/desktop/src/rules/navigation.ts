export const desktopAddress = 'porcelain://app';

const summaryPath = /^\/(?:remote-)?review-summaries\//;

export function localNavigation(url: string, origin: string): boolean {
  try {
    const target = new URL(url);
    const expected = new URL(origin);
    return (
      target.protocol === expected.protocol &&
      target.host === expected.host &&
      target.username === '' &&
      target.password === ''
    );
  } catch {
    return false;
  }
}

export function appDocument(url: string): boolean {
  return (
    localNavigation(url, desktopAddress) &&
    !summaryPath.test(new URL(url).pathname)
  );
}
