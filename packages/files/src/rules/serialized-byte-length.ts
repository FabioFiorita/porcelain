export function serializedByteLength(value: object): number {
  let bytes = 0;
  for (const character of JSON.stringify(value)) {
    const point = character.codePointAt(0) ?? 0;
    bytes += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
  }
  return bytes;
}
