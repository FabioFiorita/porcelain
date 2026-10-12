import { app } from 'electron';
import { Effect } from 'effect';
import { runDesktopMcp as relayDesktopMcp } from '@porcelain/server/desktop-mcp';

export async function runDesktopMcp(): Promise<void> {
  const args = process.argv
    .slice(app.isPackaged ? 1 : 2)
    .filter((argument) => argument !== '--porcelain-mcp');
  const code = await Effect.runPromise(
    relayDesktopMcp(args, app.getVersion()),
  );
  await new Promise<void>((resolve) =>
    process.stdout.write('', () => resolve()),
  );
  await new Promise<void>((resolve) =>
    process.stderr.write('', () => resolve()),
  );
  app.exit(code);
}
