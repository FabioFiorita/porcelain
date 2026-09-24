const CONTROL_CHARACTER = /\p{Cc}/u;

function validText(value: string, maxLength: number): string | undefined {
  const trimmed = value.trim();
  return trimmed.length === 0 ||
    trimmed.length > maxLength ||
    CONTROL_CHARACTER.test(trimmed)
    ? undefined
    : trimmed;
}

export function validLabel(
  value: string,
  maxLength: number,
): string | undefined {
  return validText(value, maxLength);
}

export function validPlatform(
  value: string,
  maxLength: number,
): string | undefined {
  return validText(value, maxLength);
}
