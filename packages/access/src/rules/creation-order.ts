export function inCreationOrder<Item extends { createdAt: string }>(
  items: readonly Item[],
): Item[] {
  return [...items].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
}
