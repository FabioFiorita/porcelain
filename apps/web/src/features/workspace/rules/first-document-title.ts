export type OwnedTitle = { owner: symbol; title: string | undefined };

export function releaseTitle(
  current: OwnedTitle | undefined,
  owner: symbol,
): OwnedTitle | undefined {
  return current?.owner === owner ? undefined : current;
}
