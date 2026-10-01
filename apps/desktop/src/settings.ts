import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { readDesktopLimits } from '@porcelain/server/desktop-settings';

export function desktopSettings(
  userData: string,
  logs: string,
  packageRoot: string,
) {
  const { values } = parseArgs({
    args: process.argv.slice(1),
    strict: false,
    allowPositionals: true,
    options: {
      'data-directory': { type: 'string' },
      'project-home': { type: 'string' },
    },
  });
  const profile = values['data-directory'];
  const projectHome = values['project-home'];
  return {
    profile: typeof profile === 'string' ? resolve(profile) : userData,
    logs: typeof profile === 'string' ? join(resolve(profile), 'logs') : logs,
    projectHome:
      typeof projectHome === 'string' ? resolve(projectHome) : homedir(),
    packageRoot,
    serverEntry: join(packageRoot, 'server/src/bootstrap/server.mjs'),
    limits: readDesktopLimits(),
  };
}
