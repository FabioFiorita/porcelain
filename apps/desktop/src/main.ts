import { app } from 'electron';
import { launchRefusal } from './rules/launch-refusal.ts';

const refusal = launchRefusal({
  packaged: app.isPackaged,
  arguments: [...process.argv.slice(1), ...process.execArgv],
  environment: process.env,
});
if (refusal === undefined) await import('./app.ts');
else {
  process.stderr.write(`${refusal}\n`);
  app.exit(1);
}
