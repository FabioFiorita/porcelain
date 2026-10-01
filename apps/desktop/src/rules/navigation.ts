export const desktopAddress = 'porcelain://app';

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

export function externalNavigation(url: string): boolean {
  try {
    const target = new URL(url);
    return (
      target.protocol === 'https:' &&
      target.username === '' &&
      target.password === ''
    );
  } catch {
    return false;
  }
}
