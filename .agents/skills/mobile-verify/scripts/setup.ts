import { Schema } from 'effect';
import { spawn, spawnSync } from 'node:child_process';
import type { MobilePlatform } from '@porcelain/mobile/kit/development-client';
import { simulatorSchema } from '@porcelain/mobile/kit/simulator';
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  identity,
  developmentLink,
  screenLink,
} from '@porcelain/mobile/kit/development-client';
import type { RemoteHost } from '@porcelain/mobile/kit/device-host';
import { agentDevice, agentDeviceMissing } from '@porcelain/mobile/kit/tools';
import { Refusal } from '../../verify-core/cli.ts';
import { shellCommand } from '../../verify-core/connection.ts';
import { hostArgs, hubToken, hubUrl } from './host.ts';
import { simulatorHost, type HostRequest } from './simulator-host.ts';

const preparedSchema = Schema.Struct({
  ...simulatorSchema.fields,
  installed: Schema.Boolean,
});
export async function prepareHost(
  host: RemoteHost | null,
  request: HostRequest & { action: 'prepare' },
) {
  if (host === null) {
    const simulator = await simulatorHost(request);
    return {
      ...simulator,
      pid: undefined,
      release: async () => {
        await simulatorHost({ ...request, action: 'release' });
      },
    };
  }
  if (host.ssh === undefined || host.checkout === undefined)
    throw new Refusal(
      'Remote start needs ssh and checkout in the private device-host config for simulator claims, app installation and cleanup. UI control uses the hub.',
    );
  const child = spawn('ssh', hostArgs(host.ssh, host.checkout, request), {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (data: Buffer) => {
    stderr += data.toString();
    process.stderr.write(data);
  });
  const exited = new Promise<void>((done, fail) => {
    child.once('error', fail);
    child.once('close', (code) => {
      if (code === 0) done();
      else
        fail(
          new Refusal(
            stderr.trim() || 'Device-host preparation or cleanup failed',
          ),
        );
    });
  });
  void exited.catch(() => undefined);
  const simulator = await new Promise<typeof preparedSchema.Type>(
    (done, fail) => {
      let stdout = '';
      const timer = setTimeout(() => {
        child.stdin.end();
        fail(new Refusal('Device-host preparation timed out.'));
      }, 180_000);
      const finish = () => clearTimeout(timer);
      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
        const newline = stdout.indexOf('\n');
        if (newline === -1) return;
        finish();
        try {
          done(
            Schema.decodeUnknownSync(preparedSchema)(
              JSON.parse(stdout.slice(0, newline)),
            ),
          );
        } catch (error) {
          child.stdin.end();
          fail(error);
        }
      });
      child.once('error', (error) => {
        finish();
        fail(error);
      });
      child.once('close', () => {
        finish();
        fail(
          new Refusal(
            stderr.trim() ||
              'Device-host preparation ended without a simulator.',
          ),
        );
      });
    },
  );
  return {
    ...simulator,
    pid: child.pid,
    release: async () => {
      child.stdin.end();
      await exited;
    },
  };
}

export function driver(
  folder: string,
  host: RemoteHost | null,
  udid: string,
  session: string,
  suppliedConfig?: string,
  suppliedCommand?: string,
  platform: MobilePlatform = 'ios',
) {
  const config = suppliedConfig ?? join(folder, 'agent-device.json');
  if (suppliedConfig === undefined)
    writeFileSync(
      config,
      JSON.stringify(
        host === null
          ? { platform }
          : {
              platform,
              daemonBaseUrl: hubUrl(host),
              daemonAuthToken: hubToken(host),
              daemonTransport: 'http',
            },
      ),
      { mode: 0o600 },
    );
  const executable = agentDevice();
  if (
    suppliedCommand === undefined &&
    (executable === undefined || !existsSync(executable))
  )
    throw new Refusal(agentDeviceMissing());
  const launcher = suppliedCommand ?? join(folder, 'agent-device');
  if (suppliedCommand === undefined)
    writeFileSync(
      launcher,
      `#!${process.execPath}
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
const transport = ['connect', 'disconnect'].includes(args[0]);
const required = transport ? ['--config', '--session'] : ['--config', '--session', '--platform', ${JSON.stringify(platform === 'ios' ? '--udid' : '--serial')}];
if (!required.every(flag => args.includes(flag) && args[args.indexOf(flag) + 1])) {
  console.error('Use the full invocation from the connection card.'); process.exit(2);
}
const env = { ...process.env, AGENT_DEVICE_STATE_DIR: '/tmp/porcelain-agent-device' };
for (const key of ['AGENT_DEVICE_DAEMON_BASE_URL', 'AGENT_DEVICE_DAEMON_AUTH_TOKEN', 'AGENT_DEVICE_CONFIG']) delete env[key];
const result = spawnSync(${JSON.stringify(executable)}, args, { env, stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
`,
      { mode: 0o700 },
    );
  const targetArgs = [
    '--config',
    config,
    '--session',
    session,
    '--platform',
    platform,
    platform === 'ios' ? '--udid' : '--serial',
    udid,
  ];
  return {
    launcher,
    config,
    targetArgs,
    command: shellCommand([launcher, ...targetArgs]),
  };
}
export type Driver = ReturnType<typeof driver>;
export function setupCommand(
  driver: Driver,
  args: readonly string[],
  session?: string,
  optional = false,
): string {
  const target = [...driver.targetArgs];
  if (args[0] === 'connect' || args[0] === 'disconnect')
    target.splice(target.indexOf('--platform'));
  if (session !== undefined) target[target.indexOf('--session') + 1] = session;
  const result = spawnSync(driver.launcher, [...args, ...target], {
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !optional)
    throw new Refusal(`${result.stdout}${result.stderr}`.trim());
  return `${result.stdout}${result.stderr}`;
}
export function pairClient(
  driver: Driver,
  metro: string,
  link: string,
  session: string,
): void {
  const run = (args: string[], optional = false) =>
    setupCommand(driver, args, session, optional);
  const ios =
    driver.targetArgs[driver.targetArgs.indexOf('--platform') + 1] === 'ios';
  try {
    if (ios) run(['prepare', 'ios-runner']);
    run(['open', identity.bundleIdentifier, '--foreground']);
    run(['open', identity.bundleIdentifier, developmentLink(metro)]);
    if (ios) run(['alert', 'accept', '5000'], true);
    run(['open', identity.bundleIdentifier, screenLink('/settings')]);
    run(['wait', 'text', 'Settings', '60000']);
    if (ios) run(['alert', 'accept', '5000'], true);
    run(['press', 'id="settings-computers"', '--settle']);
    run(['press', 'label="Add computer"', '--settle']);
    run(['fill', 'id="pairing-link"', link, '--settle']);
    run(['wait', '1500']);
    run(['press', 'id="pair-environment"', '--settle']);
    run(['wait', 'text', 'Online', '30000']);
  } catch (error) {
    try {
      run(['close']);
    } catch (cleanupError) {
      if (error instanceof Error && cleanupError instanceof Error)
        error.message += `\nSetup cleanup also failed: ${cleanupError.message}`;
    }
    throw error;
  }
  run(['close']);
}
