export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}
