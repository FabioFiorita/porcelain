export function writeStandardOutput(message: string): void {
  process.stdout.write(message);
}

export function writeStandardError(message: string): void {
  process.stderr.write(message);
}
