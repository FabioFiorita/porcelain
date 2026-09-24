export function utf8ByteLength(text: string): number {
  return encodeURIComponent(text.toWellFormed()).replace(/%[0-9A-F]{2}/g, '.')
    .length;
}
