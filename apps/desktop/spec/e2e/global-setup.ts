import { spawn } from 'node:child_process';
import { stageDesktop } from '../kit/stage.ts';
import { stagedApp } from './fixtures.ts';

export default async function globalSetup(): Promise<void> {
  if (process.platform !== 'darwin' && process.platform !== 'linux')
    throw new Error(
      'Desktop e2e tests support Linux and macOS. Run portable Electron journeys on Linux; native macOS and encrypted credential journeys need macOS.',
    );
  if (
    process.platform === 'linux' &&
    !process.env.DISPLAY &&
    !process.env.WAYLAND_DISPLAY
  )
    throw new Error(
      'Linux desktop e2e tests need a display. Use a desktop session or run xvfb-run -a pnpm --filter @porcelain/desktop test:e2e.',
    );
  if (process.platform === 'darwin')
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
