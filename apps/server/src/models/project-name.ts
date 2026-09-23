import { basename } from 'node:path';

export function deriveProjectName(
  originUrl: string | null,
  mainCheckoutPath: string,
): string {
  return fromOrigin(originUrl) ?? basename(mainCheckoutPath);
}

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const SCP_LIKE = /^[^/]*@[^/:]+:(?<path>.*)$/;

function fromOrigin(originUrl: string | null): string | null {
  if (!originUrl) return null;
  const trimmed = originUrl.trim().replace(/[/\\]+$/, '');
  if (trimmed === '') return null;
  const path = repositoryPath(trimmed);
  if (path === null) return null;
  const name = (path.split(/[/\\]/).at(-1) ?? '').replace(/\.git$/i, '');
  return /[\p{L}\p{N}]/u.test(name) ? name : null;
}

function repositoryPath(origin: string): string | null {
  if (SCHEME.test(origin)) {
    const authority = origin.replace(SCHEME, '');
    const separator = authority.indexOf('/');
    return separator === -1 ? null : authority.slice(separator + 1);
  }
  const scp = SCP_LIKE.exec(origin);
  if (scp?.groups) return scp.groups.path ?? null;
  return origin;
}
