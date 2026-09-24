export function inCreationOrder<Item extends { createdAt: string }>(
  items: readonly Item[],
): Item[] {
  return [...items].sort(
    (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
  );
}
