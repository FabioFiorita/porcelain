/**
 * The next "Terminal N": one past the highest N already handed out.
 *
 * Counting rows instead of parsing numbers hands out duplicates — close Terminal 1 and the
 * next spawn becomes a second Terminal 2 — so both the parsed maximum and the roster size
 * feed the floor. The floor itself only ever rises, because the roster is daemon-owned and a
 * poll that briefly clobbers an optimistic row must not be able to reissue a taken number.
 */
export function nextTerminalNumber(existingNames: readonly string[], floor: number): number {
  const numbers = existingNames.map((name) => {
    const match = /^Terminal (\d+)$/.exec(name)
    return match === null ? 0 : Number(match[1])
  })
  return Math.max(floor, existingNames.length, ...numbers) + 1
}
