import { spawn } from 'node:child_process';
import { stageDesktop } from '../kit/stage.ts';
import { stagedApp } from './fixtures.ts';

export default async function globalSetup(): Promise<void> {
  if (process.platform !== 'darwin')
    throw new Error(
      'The desktop e2e tests need macOS: they drive Porcelain Dev through Playwright Electron, and the Keychain behind its credentials exists only there. Run pnpm --filter @porcelain/desktop test:e2e on a Mac, in a Terminal window of the logged-in session (see .agents/skills/desktop-verify/SKILL.md).',
    );
  spawn('caffeinate', ['-d', '-u', '-w', String(process.pid)], {
    detached: true,
    stdio: 'ignore',
  }).unref();
  await stageDesktop({
    directory: stagedApp(),
    productName: 'Porcelain Dev',
    web: true,
  });
}
