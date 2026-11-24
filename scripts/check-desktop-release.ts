import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { setTimeout } from 'node:timers/promises';

const image = process.argv[2];
if (!image) throw new Error('Pass the signed Porcelain disk image');

const workspace = mkdtempSync('/tmp/porcelain-release-');
const mount = join(workspace, 'image');
const profile = join(workspace, 'profile');
const projects = join(workspace, 'projects');
const home = join(workspace, 'home');
let mounted = false;

try {
  for (const path of [mount, profile, projects, home]) mkdirSync(path);
  execFileSync(
    'hdiutil',
    ['attach', '-readonly', '-nobrowse', '-mountpoint', mount, image],
    { stdio: 'inherit' },
  );
  mounted = true;
  const mountedBundle = join(mount, 'Porcelain.app');
  const bundle =
    process.env.PORCELAIN_REHEARSAL_COPY === 'true'
      ? join(workspace, 'Porcelain.app')
      : mountedBundle;
  if (bundle !== mountedBundle)
    execFileSync('/usr/bin/ditto', [mountedBundle, bundle], {
      stdio: 'inherit',
    });
  execFileSync(
    '/usr/bin/codesign',
    ['--verify', '--deep', '--strict', bundle],
    {
      stdio: 'inherit',
    },
  );
  const env = {
    ...process.env,
    HOME: home,
    PORCELAIN_CODING_TOOL_DIRECTORY: 'none',
  };
  if (process.env.PORCELAIN_REHEARSAL_SCOPED_KEYCHAIN === 'true') {
    const directory = join(home, 'Library', 'Keychains');
    mkdirSync(directory, { recursive: true });
    mkdirSync(join(home, 'Library', 'Preferences'), { recursive: true });
    const keychain = join(directory, 'porcelain-test.keychain-db');
    const password = randomBytes(24).toString('hex');
    for (const args of [
      ['create-keychain', '-p', password, keychain],
      ['unlock-keychain', '-p', password, keychain],
      ['list-keychains', '-d', 'user', '-s', keychain],
      ['default-keychain', '-d', 'user', '-s', keychain],
    ]) {
      const command = spawnSync('/usr/bin/security', args, {
        env,
        encoding: 'utf8',
      });
      if (command.status !== 0)
        throw new Error(
          `Scoped Keychain setup failed during ${args[0]}: ${command.stderr}`,
        );
    }
  }
  const keychain = spawnSync(
    '/usr/bin/security',
    ['default-keychain', '-d', 'user'],
    {
      env,
      encoding: 'utf8',
    },
  );
  console.log(
    `Default Keychain from the app environment (${keychain.status}): ${(keychain.stdout + keychain.stderr).trim()}`,
  );
  if (
    process.env.PORCELAIN_REHEARSAL_SCOPED_KEYCHAIN === 'true' &&
    keychain.status !== 0
  )
    throw new Error('The app environment still has no default Keychain');
  const app = spawn(
    join(bundle, 'Contents', 'MacOS', 'Porcelain'),
    ['--data-directory', profile, '--project-home', projects],
    {
      env,
      stdio: ['ignore', 'inherit', 'pipe'],
    },
  );
  const exited = new Promise<string>((resolve) => {
    app.once('error', (error) => resolve(error.message));
    app.once('close', (code, signal) => resolve(String(code ?? signal)));
  });
  const ready = new Promise<void>((resolve) => {
    createInterface({ input: app.stderr }).on('line', (line) => {
      process.stderr.write(`${line}\n`);
      if (line === 'Porcelain: renderer ready') resolve();
    });
  });

  try {
    await Promise.race([
      ready,
      exited.then((reason) => {
        throw new Error(
          `Porcelain exited before its renderer was ready (${reason})`,
        );
      }),
      setTimeout(30_000, undefined, { ref: false }).then(() => {
        throw new Error(
          'The mounted Porcelain app did not report renderer readiness',
        );
      }),
    ]);
    console.log('The mounted Porcelain app reached renderer readiness.');
  } catch (error) {
    const processes = execFileSync(
      '/bin/ps',
      ['-axww', '-o', 'pid=,ppid=,state=,command='],
      {
        encoding: 'utf8',
      },
    );
    console.error(
      processes
        .split('\n')
        .filter((line) => line.includes(workspace))
        .join('\n'),
    );
    throw error;
  } finally {
    app.kill();
    const stopped = await Promise.race([
      exited.then(() => true),
      setTimeout(5_000, false, { ref: false }),
    ]);
    if (!stopped) {
      app.kill('SIGKILL');
      await exited;
    }
  }
} finally {
  if (mounted) execFileSync('hdiutil', ['detach', mount], { stdio: 'inherit' });
  rmSync(workspace, { recursive: true, force: true });
}
