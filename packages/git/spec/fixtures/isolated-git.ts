import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const emptyHome = mkdtempSync(join(tmpdir(), 'porcelain-git-spec-home-'));

for (const name of Object.keys(process.env))
  if (name.startsWith('GIT_')) delete process.env[name];
process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_SYSTEM = '/dev/null';
process.env.GIT_CONFIG_NOSYSTEM = '1';
process.env.HOME = emptyHome;
process.env.XDG_CONFIG_HOME = emptyHome;
