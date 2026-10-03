import { existsSync } from 'node:fs';
import { cp, mkdir, rename, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { buildDesktop } from './build-desktop.ts';
import { desktopCommand } from '../apps/desktop/spec/kit/stage.ts';

const target = '/Applications/Porcelain.app';
const staged = `/Applications/.Porcelain-install-${process.pid}.app`;
const backup = join(
  homedir(),
  'Library/Caches/Porcelain/build-backups.noindex',
  `${Date.now()}`,
  'Porcelain.app',
);

try {
  const built = await buildDesktop();
  await cp(built, staged, { recursive: true, verbatimSymlinks: true });
  await desktopCommand('/usr/bin/codesign', [
    '--verify',
    '--deep',
    '--strict',
    staged,
  ]);
  const replaced = existsSync(target);
  if (replaced) {
    await mkdir(join(backup, '..'), { recursive: true });
    await rename(target, backup);
  }
  try {
    await rename(staged, target);
  } catch (error) {
    if (replaced) await rename(backup, target);
    throw error;
  }
  process.stdout.write(
    `Installed ${target}\n${replaced ? `Previous app: ${backup}\n` : ''}`,
  );
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Mac app installation failed'}\n`,
  );
  process.exitCode = 1;
} finally {
  await rm(staged, { recursive: true, force: true });
}
