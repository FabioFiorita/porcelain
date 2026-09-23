import { InvalidDeviceDetailsError } from '../errors/invalid-device-details-error.ts';

const maxLabel = 80;
const maxPlatform = 120;

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return true;
  }
  return false;
}

function checkedText(value: string, limit: number): string {
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > limit ||
    hasControlCharacter(trimmed)
  )
    throw new InvalidDeviceDetailsError();
  return trimmed;
}

export function checkedLabel(value: string): string {
  return checkedText(value, maxLabel);
}

export function checkedPlatform(value: string): string {
  return checkedText(value, maxPlatform);
}
