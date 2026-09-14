import { randomBytes } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { mkdir, open } from 'node:fs/promises';
import { dirname } from 'node:path';
import { ServeConfigurationError } from './arguments.ts';

const minimumTokenLength = 32;
const tokenPattern = /^[A-Za-z0-9._~-]+$/;

function validToken(value: string): boolean {
  return value.length >= minimumTokenLength && tokenPattern.test(value);
}

async function inspectTokenFile(path: string): Promise<string> {
  let handle: Awaited<ReturnType<typeof open>>;
  try {
    handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      throw error;
    if (error instanceof Error && 'code' in error && error.code === 'ELOOP')
      throw new ServeConfigurationError(
        'The access token path must be a regular file, not a symlink',
      );
    throw new ServeConfigurationError(
      'Could not inspect the access token file',
    );
  }
  let token: string;
  try {
    const metadata = await handle.stat();
    if (!metadata.isFile() || metadata.isSymbolicLink())
      throw new ServeConfigurationError(
        'The access token path must be a regular file, not a symlink',
      );
    token = (await handle.readFile('utf8')).trim();
    await handle.chmod(0o600);
    const permissions = (await handle.stat()).mode & 0o777;
    if (permissions !== 0o600)
      throw new ServeConfigurationError(
        'The access token file must use mode 0600',
      );
  } catch (error) {
    if (error instanceof ServeConfigurationError) throw error;
    throw new ServeConfigurationError('Could not read the access token file');
  } finally {
    await handle.close();
  }
  if (!validToken(token))
    throw new ServeConfigurationError(
      'The access token file must contain a strong token of at least 32 safe characters',
    );
  return token;
}

/** Create or reuse the persistent bearer token without printing its value. */
export async function ensureAccessToken(tokenFile: string): Promise<string> {
  await mkdir(dirname(tokenFile), { recursive: true, mode: 0o700 });
  try {
    const handle = await open(tokenFile, 'wx', 0o600);
    const token = randomBytes(32).toString('base64url');
    try {
      await handle.writeFile(token, 'utf8');
      await handle.chmod(0o600);
    } finally {
      await handle.close();
    }
    return token;
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST'))
      throw new ServeConfigurationError(
        'Could not create the access token file',
      );
    return inspectTokenFile(tokenFile);
  }
}
