const ONE_BYTE_BELOW = 0x80;
const TWO_BYTES_BELOW = 0x800;
const THREE_BYTES_BELOW = 0x10000;

export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (const character of text) {
    const point = character.codePointAt(0) ?? 0;
    if (point < ONE_BYTE_BELOW) bytes += 1;
    else if (point < TWO_BYTES_BELOW) bytes += 2;
    else if (point < THREE_BYTES_BELOW) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}
