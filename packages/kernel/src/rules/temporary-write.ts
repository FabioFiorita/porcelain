const TEMPORARY_WRITE =
  /(?:^|\/)\.porcelain-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.tmp$/;

export function temporaryWriteName(id: string): string {
  return `.porcelain-${id}.tmp`;
}

export function isTemporaryWrite(path: string): boolean {
  return TEMPORARY_WRITE.test(path);
}
