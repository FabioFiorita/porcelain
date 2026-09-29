export function localNavigation(url: string, origin: string): boolean {
  try {
    const target = new URL(url);
    return (
      target.origin === origin &&
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
