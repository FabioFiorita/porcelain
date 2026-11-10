const specDirectory = new Set(['spec', 'specs', '__tests__', 'tests']);

export function isSpecPath(path: string) {
  const name = path.slice(path.lastIndexOf('/') + 1);
  if (
    /\.(?:spec|test|browser)\.[^.]+$/.test(name) ||
    /_(?:test|spec)\.[^.]+$/.test(name) ||
    /^test_.+\.py$/.test(name) ||
    /(?:Test|Tests|Spec)\.(?:java|kt|cs|swift|scala)$/.test(name)
  )
    return true;
  const segments = path.split('/');
  return segments.slice(0, -1).some((segment) => specDirectory.has(segment));
}

export function groupSpecPaths<T extends { path: string }>(
  entries: readonly T[],
  grouped: boolean,
): readonly T[] {
  if (!grouped) return entries;
  const rest: T[] = [];
  const specs: T[] = [];
  for (const entry of entries) {
    if (isSpecPath(entry.path)) specs.push(entry);
    else rest.push(entry);
  }
  return [...rest, ...specs];
}
