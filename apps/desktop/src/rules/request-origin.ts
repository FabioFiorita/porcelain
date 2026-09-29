export function desktopRequestOrigin(origin: string | null): boolean {
  return origin === null || origin === 'porcelain://app';
}
