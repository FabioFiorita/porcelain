export function externalLink(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' ||
        url.protocol === 'https:' ||
        url.protocol === 'mailto:') &&
      url.username === '' &&
      url.password === ''
    );
  } catch {
    return false;
  }
}
