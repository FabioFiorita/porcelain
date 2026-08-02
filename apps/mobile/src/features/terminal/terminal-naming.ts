/** Choose the next human-readable terminal name without reusing a closed number. */
export function nextTerminalNumber(existingNames: readonly string[], floor: number): number {
  const numbers = existingNames.map((name) => {
    const match = /^Terminal (\d+)$/.exec(name)
    return match === null ? 0 : Number(match[1])
  })
  return Math.max(floor, existingNames.length, ...numbers) + 1
}
