import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  lstat,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { isDeepStrictEqual } from 'node:util';
import { FuseState, FuseV1Options, getCurrentFuseWire } from '@electron/fuses';

const executable = '/Applications/Porcelain.app/Contents/MacOS/Porcelain';
const launchWithinMs = 60_000;
const startWithinMs = 30_000;
const pollMs = 250;

const lockedFuses: [string, FuseV1Options, FuseState][] = [
  ['RunAsNode', FuseV1Options.RunAsNode, FuseState.DISABLE],
  [
    'EnableNodeOptionsEnvironmentVariable',
    FuseV1Options.EnableNodeOptionsEnvironmentVariable,
    FuseState.DISABLE,
  ],
  [
    'EnableNodeCliInspectArguments',
    FuseV1Options.EnableNodeCliInspectArguments,
    FuseState.DISABLE,
  ],
  [
    'EnableEmbeddedAsarIntegrityValidation',
    FuseV1Options.EnableEmbeddedAsarIntegrityValidation,
    FuseState.ENABLE,
  ],
  ['OnlyLoadAppFromAsar', FuseV1Options.OnlyLoadAppFromAsar, FuseState.ENABLE],
  [
    'EnableCookieEncryption',
    FuseV1Options.EnableCookieEncryption,
    FuseState.ENABLE,
  ],
  [
    'GrantFileProtocolExtraPrivileges',
    FuseV1Options.GrantFileProtocolExtraPrivileges,
    FuseState.DISABLE,
  ],
];
const ownerProfileEntries = [
  'SingletonLock',
  'SingletonSocket',
  'SingletonCookie',
  'DevToolsActivePort',
  'Local State',
  'window.json',
  'credentials.enc',
];

function fuseName(state: FuseState | undefined): string {
  if (state === FuseState.ENABLE) return 'on';
  if (state === FuseState.DISABLE) return 'off';
  return `unexpected ${String(state)}`;
}

function runningCopies(): number[] {
  return execFileSync('/bin/ps', ['-axo', 'pid=,comm='], { encoding: 'utf8' })
    .split('\n')
    .flatMap((line) => {
      const match = /^\s*(\d+)\s+(.+)$/.exec(line);
      return match?.[2] === executable ? [Number(match[1])] : [];
    });
}

async function ownerProfileState(profile: string) {
  return Promise.all(
    ownerProfileEntries.map(
      async (name): Promise<[string, number | 'absent']> => {
        const entry = await lstat(join(profile, name)).catch(() => undefined);
        return [name, entry?.mtimeMs ?? 'absent'];
      },
    ),
  );
}

async function launch(input: {
  profile: string;
  arguments: string[];
  environment: Record<string, string>;
  waitForStart: boolean;
}) {
  const environment: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env))
    if (
      value !== undefined &&
      name !== 'ELECTRON_RUN_AS_NODE' &&
      name !== 'NODE_OPTIONS'
    )
      environment[name] = value;
  const child = spawn(
    executable,
    [...input.arguments, '--data-directory', input.profile],
    {
      env: { ...environment, ...input.environment },
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: launchWithinMs,
      killSignal: 'SIGKILL',
    },
  );
  const output: Buffer[] = [];
  child.stdout.on('data', (chunk: Buffer) => output.push(chunk));
  child.stderr.on('data', (chunk: Buffer) => output.push(chunk));
  const closed = new Promise<[number | null, string | null]>(
    (resolveExit, rejectExit) => {
      child.once('error', rejectExit);
      child.once('close', (exitCode, exitSignal) =>
        resolveExit([exitCode, exitSignal]),
      );
    },
  );
  let started = false;
  if (input.waitForStart) {
    const socket = join(input.profile, 'server', 'server.sock');
    for (
      const deadline = Date.now() + startWithinMs;
      Date.now() < deadline && child.exitCode === null && !started;
      started = existsSync(socket)
    )
      await sleep(pollMs);
    child.kill('SIGTERM');
  }
  const [code, signal] = await closed;
  return {
    code,
    signal,
    started,
    output: Buffer.concat(output).toString('utf8'),
  };
}

export async function checkInstalledApp(evidence: string): Promise<string> {
  if (!existsSync(executable))
    return `No installed app at ${executable}; there is nothing to check.\n`;
  await mkdir(evidence, { recursive: true });
  const scratch = await realpath(
    await mkdtemp(join(tmpdir(), 'porcelain-installed-check-')),
  );
  try {
    const wire = await getCurrentFuseWire(resolve(executable, '../../..'));
    const fuses = lockedFuses.map(([name, option, locked]) => ({
      fuse: name,
      state: fuseName(wire[option]),
      locked: fuseName(locked),
    }));
    const ownerProfile = join(
      homedir(),
      'Library/Application Support/Porcelain',
    );
    const copiesBefore = runningCopies();
    const profileBefore = await ownerProfileState(ownerProfile);
    const marker = join(scratch, 'node-ran');
    const payload = `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'ran');\n`;
    const payloadFile = join(scratch, 'payload.cjs');
    await writeFile(payloadFile, payload);
    const launches = [
      { name: 'inspect', arguments: ['--inspect=0'], environment: {} },
      {
        name: 'remote-debugging-port',
        arguments: ['--remote-debugging-port=0'],
        environment: {},
      },
      {
        name: 'run-as-node',
        arguments: ['-e', payload],
        environment: { ELECTRON_RUN_AS_NODE: '1' },
      },
      {
        name: 'node-options',
        arguments: [],
        environment: { NODE_OPTIONS: `--inspect=0 --require ${payloadFile}` },
      },
    ];
    const observed = [];
    for (const entry of launches) {
      const profile = join(scratch, entry.name);
      const result = await launch({
        profile,
        arguments: entry.arguments,
        environment: entry.environment,
        waitForStart: entry.name === 'node-options',
      });
      observed.push({
        launch: entry.name,
        exitCode: result.code,
        signal: result.signal,
        serverStarted: result.started,
        profileCreated: existsSync(profile),
        debuggingEndpointOpened: /Debugger listening|DevTools listening/.test(
          result.output,
        ),
        nodeCodeRan: existsSync(marker),
        output: result.output.trim(),
      });
    }
    const report = {
      app: executable,
      fuses,
      launches: observed,
      runningCopies: { before: copiesBefore, after: runningCopies() },
      ownerProfileUnchanged: isDeepStrictEqual(
        await ownerProfileState(ownerProfile),
        profileBefore,
      ),
    };
    const text = `${JSON.stringify(report, null, 2)}\n`;
    await writeFile(join(evidence, 'installed-check.json'), text);
    return `${text}\nrecorded ${join(evidence, 'installed-check.json')}\n`;
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
