/** Files larger than this are not read into memory for viewing. */
export const MAX_READ_BYTES = 10 * 1024 * 1024

export function exceedsReadLimit(size: number): boolean {
  return size > MAX_READ_BYTES
}
