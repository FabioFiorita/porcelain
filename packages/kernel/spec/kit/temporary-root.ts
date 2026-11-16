import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';

export const temporaryRoot = realpathSync(
  process.platform === 'darwin' ? '/tmp' : tmpdir(),
);
