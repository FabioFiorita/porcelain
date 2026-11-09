export function documentHeading(
  path: string,
  details: readonly (string | undefined)[] = [],
): { title: string; subtitle: string | undefined } {
  const segments = path.split('/');
  const subtitle = [segments.slice(0, -1).join('/'), ...details]
    .filter(Boolean)
    .join(' · ');
  return {
    title: segments.at(-1) || 'File',
    subtitle: subtitle || undefined,
  };
}
