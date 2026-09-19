/**
 * Hidden paths are project-scoped and only affect browsing in Files. A folder
 * is stored with its trailing `/` and hides everything under it. Changes the
 * agent made are never hidden from review.
 */

/** The hidden entry that hides `path`: the path itself or its nearest hidden folder. */
export function hiddenBy(
  path: string,
  hidden: ReadonlySet<string>,
): string | null {
  if (hidden.has(path)) return path;
  let best: string | null = null;
  for (const entry of hidden) {
    if (
      entry.endsWith('/') &&
      path.startsWith(entry) &&
      (best == null || entry.length > best.length)
    )
      best = entry;
  }
  return best;
}

export const isHidden = (path: string, hidden: ReadonlySet<string>) =>
  hiddenBy(path, hidden) != null;

export function visiblePaths(
  paths: readonly string[],
  hidden: ReadonlySet<string>,
): string[] {
  if (hidden.size === 0) return [...paths];
  return paths.filter((path) => !isHidden(path, hidden));
}

/** `docs/decisions/` → `decisions/`, `docs/a.md` → `a.md`. */
export function entryName(path: string): string {
  const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
  const name = trimmed.split('/').pop() ?? trimmed;
  return path.endsWith('/') ? `${name}/` : name;
}

/**
 * A relative link (an image in Markdown) read from `file`'s folder, as GitHub does; a leading `/`
 * is the repository root. Null for anything that is not a path in the repository.
 */
export function resolveRelativePath(file: string, src: string): string | null {
  const target = src.split(/[?#]/)[0] ?? '';
  if (
    target === '' ||
    target.startsWith('//') ||
    /^[a-z][a-z0-9+.-]*:/i.test(target)
  )
    return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    return null;
  }
  const parts = target.startsWith('/') ? [] : file.split('/').slice(0, -1);
  for (const part of decoded.split('/')) {
    if (part === '' || part === '.') continue;
    if (part !== '..') parts.push(part);
    else if (parts.pop() == null) return null;
  }
  return parts.length === 0 ? null : parts.join('/');
}
