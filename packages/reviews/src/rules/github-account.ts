import type {
  GitHubAccountPreference,
  GitHubChoice,
  GitHubRepository,
} from '../models/pull-request.ts';

export function githubRepository(
  origin: string | undefined,
): GitHubRepository | undefined {
  if (origin === undefined) return undefined;
  const scp = /^(?:git@)?github\.com:([^/]+)\/([^/]+?)(?:\.git)?\/?$/i.exec(
    origin.trim(),
  );
  if (scp?.[1] && scp[2]) return { owner: scp[1], repo: scp[2] };
  const url = URL.parse(origin.trim()) ?? undefined;
  if (
    url === undefined ||
    url.hostname.toLowerCase() !== 'github.com' ||
    !['https:', 'ssh:'].includes(url.protocol)
  )
    return undefined;
  const parts = url.pathname
    .replace(/^\//, '')
    .replace(/\/$/, '')
    .replace(/\.git$/, '')
    .split('/');
  return parts.length === 2 && parts[0] && parts[1]
    ? { owner: parts[0], repo: parts[1] }
    : undefined;
}
export function githubAccountCandidates(
  accounts: readonly string[],
  preference: GitHubAccountPreference | undefined,
  repository: string,
): readonly string[] {
  if (preference?.override !== undefined)
    return accounts.includes(preference.override) ? [preference.override] : [];
  const detected =
    preference?.repository === repository ? preference.detected : undefined;
  return [
    ...new Set([
      ...(detected === undefined ? [] : [detected]),
      ...[...accounts].sort(),
    ]),
  ].filter((account) => accounts.includes(account));
}
export function pickGitHubAccount(
  candidates: readonly { account: string; canRead: boolean }[],
  override: string | undefined,
): GitHubChoice | undefined {
  const account =
    override === undefined
      ? candidates.find((candidate) => candidate.canRead)?.account
      : candidates.find(
          (candidate) => candidate.account === override && candidate.canRead,
        )?.account;
  return account === undefined
    ? undefined
    : { account, source: override === undefined ? 'detected' : 'overridden' };
}
