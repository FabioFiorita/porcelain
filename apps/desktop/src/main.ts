import { app } from 'electron';
import { launchRefusal } from './rules/launch-refusal.ts';

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
} else await import('./app.ts');
