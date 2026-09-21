import { execFile } from 'node:child_process';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const serviceName = 'porcelain.service';
export const launchdLabel = 'com.fabiofiorita.porcelain';

type CommandResult = {
  code: number;
  stdout: string;
  stderr: string;
};

export type CommandRunner = (
  command: string,
  args: readonly string[],
  options?: { cwd?: string },
) => Promise<CommandResult>;

export const runCommand: CommandRunner = async (command, args, options) => {
  try {
    const result = await execFileAsync(command, [...args], {
      cwd: options?.cwd,
      encoding: 'utf8',
      timeout: 60_000,
      maxBuffer: 1024 * 1024,
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const failure = error as {
      code?: number | string;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    return {
      code: typeof failure.code === 'number' ? failure.code : 1,
      stdout: failure.stdout ?? '',
      stderr: failure.stderr ?? failure.message ?? '',
    };
  }
};

export type ServicePlan = {
  nodeExecutable: string;
  entryPoint: string;
  dataDirectory: string;
  host: string;
  port: number;
  allowedHosts: string[];
  stdoutLog: string;
  stderrLog: string;
  environmentPath: string;
};

type ServiceProbe = {
  enabled: boolean;
  running: boolean;
  linger: 'enabled' | 'disabled' | 'unavailable' | 'not-applicable';
};

export interface ServiceManager {
  readonly kind: 'systemd' | 'launchd';
  readonly unitPath: string;
  write(plan: ServicePlan): Promise<void>;
  enableAndStart(): Promise<void>;
  stop(): Promise<void>;
  start(): Promise<void>;
  uninstall(): Promise<void>;
  probe(): Promise<ServiceProbe>;
  processId(): Promise<number | null>;
  enableLinger(): Promise<boolean>;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function systemdUnit(plan: ServicePlan): string {
  const args = [
    plan.nodeExecutable,
    plan.entryPoint,
    'serve',
    '--data-directory',
    plan.dataDirectory,
    '--host',
    plan.host,
    '--port',
    String(plan.port),
    ...plan.allowedHosts.flatMap((host) => ['--allow-host', host]),
  ];
  return `[Unit]
Description=Porcelain review server
After=network.target

[Service]
Type=simple
Environment=${systemdArgument(`PATH=${plan.environmentPath}`)}
ExecStart=${args.map(systemdArgument).join(' ')}
Restart=on-failure
RestartSec=2
StandardOutput=append:${systemdPathValue(plan.stdoutLog)}
StandardError=append:${systemdPathValue(plan.stderrLog)}

[Install]
WantedBy=default.target
`;
}

function systemdValue(value: string): string {
  let output = '';
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (character === '%') output += '%%';
    else if (character === '\\') output += '\\\\';
    else if (character === '"') output += '\\"';
    else if (code < 0x20 || code === 0x7f)
      output += `\\x${code.toString(16).padStart(2, '0')}`;
    else output += character;
  }
  return output;
}

function systemdArgument(value: string): string {
  return `"${systemdValue(value)}"`;
}

function systemdPathValue(value: string): string {
  return systemdValue(value).replaceAll(' ', '\\x20');
}

function xml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function launchdPlist(plan: ServicePlan): string {
  const args = [
    plan.nodeExecutable,
    plan.entryPoint,
    'serve',
    '--data-directory',
    plan.dataDirectory,
    '--host',
    plan.host,
    '--port',
    String(plan.port),
    ...plan.allowedHosts.flatMap((host) => ['--allow-host', host]),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${launchdLabel}</string>
<key>ProgramArguments</key><array>${args.map((argument) => `<string>${xml(argument)}</string>`).join('')}</array>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>${xml(plan.environmentPath)}</string></dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>${xml(plan.stdoutLog)}</string>
<key>StandardErrorPath</key><string>${xml(plan.stderrLog)}</string>
</dict></plist>
`;
}

async function writeUnit(path: string, contents: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, { mode: 0o600 });
}

async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function required(
  runner: CommandRunner,
  description: string,
  command: string,
  args: readonly string[],
) {
  const result = await runner(command, args);
  if (result.code !== 0)
    throw new Error(
      `${description} failed (${command} ${args.map(shellQuote).join(' ')}): ${result.stderr.trim() || `exit ${result.code}`}`,
    );
}

export function serviceManager(options: {
  platform: NodeJS.Platform;
  homeDirectory: string;
  uid: number;
  runner: CommandRunner;
}): ServiceManager {
  const { platform, homeDirectory, uid, runner } = options;
  if (platform === 'linux') {
    const unitPath = join(homeDirectory, '.config/systemd/user', serviceName);
    return {
      kind: 'systemd',
      unitPath,
      write: async (plan) => writeUnit(unitPath, systemdUnit(plan)),
      enableAndStart: async () => {
        await required(runner, 'systemd reload', 'systemctl', [
          '--user',
          'daemon-reload',
        ]);
        await required(runner, 'service start', 'systemctl', [
          '--user',
          'enable',
          '--now',
          serviceName,
        ]);
      },
      stop: async () => {
        await required(runner, 'service stop', 'systemctl', [
          '--user',
          'stop',
          serviceName,
        ]);
        if (
          (await runner('systemctl', ['--user', 'is-active', serviceName]))
            .code === 0
        )
          throw new Error(`${serviceName} remained active after stop.`);
      },
      start: async () =>
        required(runner, 'service start', 'systemctl', [
          '--user',
          'start',
          serviceName,
        ]),
      uninstall: async () => {
        await required(runner, 'service disable', 'systemctl', [
          '--user',
          'disable',
          '--now',
          serviceName,
        ]);
        if (
          (await runner('systemctl', ['--user', 'is-active', serviceName]))
            .code === 0
        )
          throw new Error(`${serviceName} remained active after disable.`);
        await import('node:fs/promises').then(({ rm }) =>
          rm(unitPath, { force: true }),
        );
        await required(runner, 'systemd reload', 'systemctl', [
          '--user',
          'daemon-reload',
        ]);
      },
      probe: async () => {
        const [enabled, active, linger] = await Promise.all([
          runner('systemctl', ['--user', 'is-enabled', serviceName]),
          runner('systemctl', ['--user', 'is-active', serviceName]),
          runner('loginctl', [
            'show-user',
            String(uid),
            '--property=Linger',
            '--value',
          ]),
        ]);
        return {
          enabled: enabled.code === 0 && enabled.stdout.trim() === 'enabled',
          running: active.code === 0 && active.stdout.trim() === 'active',
          linger:
            linger.code !== 0
              ? 'unavailable'
              : linger.stdout.trim() === 'yes'
                ? 'enabled'
                : 'disabled',
        };
      },
      processId: async () => {
        const result = await runner('systemctl', [
          '--user',
          'show',
          serviceName,
          '--property=MainPID',
          '--value',
        ]);
        const pid = Number(result.stdout.trim());
        return result.code === 0 && Number.isSafeInteger(pid) && pid > 0
          ? pid
          : null;
      },
      enableLinger: async () =>
        (
          await runner('loginctl', [
            'enable-linger',
            '--no-ask-password',
            String(uid),
          ])
        ).code === 0,
    };
  }
  if (platform === 'darwin') {
    const unitPath = join(
      homeDirectory,
      'Library/LaunchAgents',
      `${launchdLabel}.plist`,
    );
    const domain = `gui/${uid}`;
    const target = `${domain}/${launchdLabel}`;
    const isMissing = (result: CommandResult) =>
      result.code !== 0 &&
      /could not find service|service not found|no such process/i.test(
        result.stderr,
      );
    const isRunning = async () => {
      const result = await runner('launchctl', ['print', target]);
      if (result.code === 0) return true;
      if (isMissing(result)) return false;
      throw new Error(
        `Could not determine whether ${launchdLabel} is running: ${result.stderr.trim() || `exit ${result.code}`}`,
      );
    };
    return {
      kind: 'launchd',
      unitPath,
      write: async (plan) => writeUnit(unitPath, launchdPlist(plan)),
      enableAndStart: async () => {
        await runner('launchctl', ['enable', target]);
        await required(runner, 'launch agent start', 'launchctl', [
          'bootstrap',
          domain,
          unitPath,
        ]);
      },
      stop: async () => {
        if (!(await isRunning())) return;
        await required(runner, 'launch agent stop', 'launchctl', [
          'bootout',
          '--wait',
          target,
        ]);
        if (await isRunning())
          throw new Error(`${launchdLabel} remained active after bootout.`);
      },
      start: async () =>
        required(runner, 'launch agent start', 'launchctl', [
          'bootstrap',
          domain,
          unitPath,
        ]),
      uninstall: async () => {
        if (await isRunning()) {
          await required(runner, 'launch agent stop', 'launchctl', [
            'bootout',
            '--wait',
            target,
          ]);
          if (await isRunning())
            throw new Error(`${launchdLabel} remained active after bootout.`);
        }
        await import('node:fs/promises').then(({ rm }) =>
          rm(unitPath, { force: true }),
        );
      },
      probe: async () => ({
        enabled: await exists(unitPath),
        running: await isRunning(),
        linger: 'not-applicable',
      }),
      processId: async () => {
        const result = await runner('launchctl', ['print', target]);
        const pid = /\bpid\s*=\s*(\d+)/.exec(result.stdout)?.[1];
        return result.code === 0 && pid ? Number(pid) : null;
      },
      enableLinger: async () => true,
    };
  }
  throw new Error(
    `Porcelain services support Linux systemd user services and macOS launchd, not ${platform}.`,
  );
}
