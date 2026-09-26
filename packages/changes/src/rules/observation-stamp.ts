export function observationStamp(
  stamps: ReadonlyMap<string, string>,
  stagingStamp: string | undefined,
): string {
  return JSON.stringify({
    files: [...stamps].sort(([left], [right]) => left.localeCompare(right)),
    staging: stagingStamp ?? '',
  });
}
