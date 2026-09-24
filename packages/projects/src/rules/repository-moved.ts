export function repositoryMoved(
  known: { repositoryIdentity: string },
  listed: { repositoryIdentity: string },
): boolean {
  return known.repositoryIdentity !== listed.repositoryIdentity;
}
