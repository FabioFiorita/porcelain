const MAX_LABEL_LENGTH = 80;
const MAX_PLATFORM_LENGTH = 120;

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return true;
  }
  return false;
}

function validText(value: string, limit: number): string | undefined {
  const trimmed = value.trim();
  return trimmed.length === 0 ||
    trimmed.length > limit ||
    hasControlCharacter(trimmed)
    ? undefined
    : trimmed;
}

export function validLabel(value: string): string | undefined {
  return validText(value, MAX_LABEL_LENGTH);
}

export function validPlatform(value: string): string | undefined {
  return validText(value, MAX_PLATFORM_LENGTH);
}
