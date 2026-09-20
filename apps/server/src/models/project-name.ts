import { basename } from 'node:path';

/**
 * What to call a project.
 *
 * The repository name in the `origin` URL, which is what the owner calls it
 * everywhere else. Without an origin — or with one that carries no repository
 * name — the main checkout's own folder, which is not the same as the folder
 * containing the Git directory: a repository whose Git directory lives
 * elsewhere would otherwise be named after that directory's parent.
 */
export function deriveProjectName(
  originUrl: string | null,
  mainCheckoutPath: string,
): string {
  return fromOrigin(originUrl) ?? basename(mainCheckoutPath);
}

/** `scheme://`, which Git accepts for ssh, https, git and file URLs. */
const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
/** `user@host:path`, the shorthand Git accepts for ssh. */
const SCP_LIKE = /^[^/]*@[^/:]+:(?<path>.*)$/;

function fromOrigin(originUrl: string | null): string | null {
  if (!originUrl) return null;
  const trimmed = originUrl.trim().replace(/[/\\]+$/, '');
  if (trimmed === '') return null;
  const path = repositoryPath(trimmed);
  // The host is not the repository: an origin with no path names nothing.
  if (path === null) return null;
  const name = (path.split(/[/\\]/).at(-1) ?? '').replace(/\.git$/i, '');
  // A name has to be nameable: an origin that is only punctuation is not a
  // repository name, whatever Git stored in it.
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
