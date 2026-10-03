import { folderName } from './folder-name.ts';

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const SCP_LIKE = /^[^/]*@[^/:]+:(?<path>.*)$/;

export function deriveProjectName(
  originUrl: string | undefined,
  mainCheckoutPath: string,
): string {
  return fromOrigin(originUrl) ?? folderName(mainCheckoutPath);
}

function fromOrigin(originUrl: string | undefined): string | undefined {
  if (!originUrl) return undefined;
  const trimmed = originUrl.trim().replace(/[/\\]+$/, '');
  if (trimmed === '') return undefined;
  const path = repositoryPath(trimmed);
  if (path === undefined) return undefined;
  const name = (path.split(/[/\\]/).at(-1) ?? '').replace(/\.git$/i, '');
  return /[\p{L}\p{N}]/u.test(name) ? name : undefined;
}

function repositoryPath(origin: string): string | undefined {
  if (SCHEME.test(origin)) {
    const authority = origin.replace(SCHEME, '');
    const separator = authority.indexOf('/');
    return separator === -1 ? undefined : authority.slice(separator + 1);
  }
  const scp = SCP_LIKE.exec(origin);
  if (scp?.groups) return scp.groups.path;
  return origin;
}
