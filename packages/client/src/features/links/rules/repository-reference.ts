import { externalLink } from './external-link.ts';

export type RepositoryReference =
  | { kind: 'repository'; path: string; hash: string }
  | { kind: 'fragment'; hash: string }
  | { kind: 'external'; url: string }
  | { kind: 'refused' };

const REFUSED: RepositoryReference = { kind: 'refused' };
const SCHEME = /^[A-Za-z][A-Za-z\d+.-]*:/;

function decoded(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

export function repositoryReference(
  document: string,
  reference: string,
): RepositoryReference {
  const value = reference.trim();
  if (value === '') return REFUSED;
  if (value.startsWith('#')) return { kind: 'fragment', hash: value };
  if (SCHEME.test(value))
    return externalLink(value) ? { kind: 'external', url: value } : REFUSED;
  if (value.startsWith('//') || value.includes('\\')) return REFUSED;
  const hashAt = value.indexOf('#');
  const hash = hashAt === -1 ? '' : value.slice(hashAt);
  const beforeHash = hashAt === -1 ? value : value.slice(0, hashAt);
  const queryAt = beforeHash.indexOf('?');
  const raw = queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt);
  const path = decoded(raw);
  if (
    path === undefined ||
    path === '' ||
    path.includes('\0') ||
    path.includes('\\')
  )
    return REFUSED;
  const segments = path.startsWith('/') ? [] : document.split('/').slice(0, -1);
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (segments.length === 0) return REFUSED;
      segments.pop();
      continue;
    }
    if (part.toLowerCase() === '.git') return REFUSED;
    segments.push(part);
  }
  if (segments.length === 0) return REFUSED;
  return { kind: 'repository', path: segments.join('/'), hash };
}
