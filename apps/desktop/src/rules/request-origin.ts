import { desktopAddress } from './navigation.ts';

export function desktopRequestOrigin(origin: string | null): boolean {
  return origin === null || origin === desktopAddress;
}
