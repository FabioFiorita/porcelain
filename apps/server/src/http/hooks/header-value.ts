export function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value.join(', ') : value;
}
