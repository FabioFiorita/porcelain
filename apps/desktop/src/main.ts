import { app } from 'electron';
import { launchRefusal } from './rules/launch-refusal.ts';
import { WATCH_HOST_SWITCH } from './protocol.ts';

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
} else if (process.argv.includes(WATCH_HOST_SWITCH)) {
  const profile = process.argv[process.argv.indexOf(WATCH_HOST_SWITCH) + 1];
  if (profile !== undefined) app.setPath('userData', profile);
  app.dock?.hide();
  await import('@porcelain/server/watch-host');
} else await import('./app.ts');
