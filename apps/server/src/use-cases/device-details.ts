import { InvalidDeviceDetailsError } from './errors/invalid-device-details-error.ts';

const maxLabel = 80;
const maxPlatform = 120;
/**
 * C0 and C1 controls, including ESC. `porcelain devices` prints these values in
 * the owner's terminal, where an escape sequence could repaint the listing or
 * hide a row, and a paired device chooses its own platform string.
 *
 * Tested by code point rather than a character class: a regex holding literal
 * control characters is exactly what the linter refuses, and rightly.
 */
function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return true;
  }
  return false;
}

function checkedText(value: string, field: string, limit: number): string {
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > limit ||
    hasControlCharacter(trimmed)
  )
    throw new InvalidDeviceDetailsError(field);
  return trimmed;
}

export function checkedLabel(value: string): string {
  return checkedText(value, 'name', maxLabel);
}

export function checkedPlatform(value: string): string {
  return checkedText(value, 'platform', maxPlatform);
}
