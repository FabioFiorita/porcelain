import { app } from 'electron';
import { launchRefusal } from './rules/launch-refusal.ts';
import { WATCH_HOST_SWITCH } from './protocol.ts';

const watchHostProfile = process.argv
  .find((argument) => argument.startsWith(`${WATCH_HOST_SWITCH}=`))
  ?.slice(WATCH_HOST_SWITCH.length + 1);
const refusal = launchRefusal({
  packaged: app.isPackaged,
  arguments: [...process.argv.slice(1), ...process.execArgv],
  environment: process.env,
});
if (refusal !== undefined) {
  process.stderr.write(`${refusal}\n`);
  app.exit(1);
} else if (process.argv.includes('--porcelain-mcp')) {
  const { runDesktopMcp } = await import('./adapters/mcp.ts');
  await runDesktopMcp();
} else if (watchHostProfile !== undefined) {
  app.setPath('userData', watchHostProfile);
  app.disableHardwareAcceleration();
  app.dock?.hide();
  await import('@porcelain/server/watch-host').catch((error: unknown) => {
    process.stderr.write(
      `Porcelain file watcher failed to start: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    app.exit(1);
  });
} else await import('./app.ts');
