import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { readDesktopLimits } from '@porcelain/server/desktop-settings';
import { developmentWeb } from './rules/development-web.ts';

export function desktopSettings(
  userData: string,
  logs: string,
  packageRoot: string,
  packaged: boolean,
) {
  const { values } = parseArgs({
    args: process.argv.slice(1),
    strict: false,
    allowPositionals: true,
    options: {
      'data-directory': { type: 'string' },
      'project-home': { type: 'string' },
      'web-dev-server': { type: 'string' },
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
    development: developmentWeb(packaged, values['web-dev-server']),
    serverEntry: join(packageRoot, 'server/src/bootstrap/server.mjs'),
    limits: readDesktopLimits(),
  };
}
