export function serializedByteLength(value: object): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}
