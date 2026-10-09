export function isPreviewLink(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'http:' ||
      url.protocol === 'https:' ||
      url.protocol === 'mailto:'
    );
  } catch {
    return false;
  }
}
