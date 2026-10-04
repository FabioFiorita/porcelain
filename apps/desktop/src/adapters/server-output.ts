import { closeSync } from 'node:fs';

export async function finishServerOutput(): Promise<void> {
  await Promise.all([
    new Promise<void>((resolve) => process.stdout.end(resolve)),
    new Promise<void>((resolve) =>
      process.stderr.end('Porcelain server: closed\n', resolve),
    ),
  ]);
  closeSync(1);
  closeSync(2);
}
