import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { CommandRunner } from './command-runner.ts';
import { ServiceCommandFailedError } from './errors/service-command-failed-error.ts';
import { ServiceStillActiveError } from './errors/service-still-active-error.ts';
import { exists } from './json-file.ts';
import {
  renderSystemdUnit,
  SERVICE_UNIT_NAME,
  type ServicePlan,
} from './systemd-unit.ts';

export type Linger = 'enabled' | 'disabled' | 'unavailable';

type ServiceProbe = {
  enabled: boolean;
  running: boolean;
  linger: Linger;
};

export class SystemdService {
  readonly unitPath: string;
  private readonly uid: number;
  private readonly runner: CommandRunner;

  constructor(homeDirectory: string, uid: number, runner: CommandRunner) {
    this.unitPath = join(
      homeDirectory,
      '.config/systemd/user',
      SERVICE_UNIT_NAME,
    );
    this.uid = uid;
    this.runner = runner;
  }

  unitExists(): Promise<boolean> {
    return exists(this.unitPath);
  }

  async write(plan: ServicePlan): Promise<void> {
    await mkdir(dirname(this.unitPath), { recursive: true });
    await writeFile(this.unitPath, renderSystemdUnit(plan), { mode: 0o600 });
  }

  async enableAndStart(): Promise<void> {
    await this.required('systemd reload', ['--user', 'daemon-reload']);
    await this.required('service start', [
      '--user',
      'enable',
      '--now',
      SERVICE_UNIT_NAME,
    ]);
  }

  async start(): Promise<void> {
    await this.required('service start', [
      '--user',
      'start',
      SERVICE_UNIT_NAME,
    ]);
  }

  async stop(): Promise<void> {
    await this.required('service stop', ['--user', 'stop', SERVICE_UNIT_NAME]);
    if (await this.isActive()) throw new ServiceStillActiveError('stop');
  }

  async uninstall(): Promise<void> {
    await this.required('service disable', [
      '--user',
      'disable',
      '--now',
      SERVICE_UNIT_NAME,
    ]);
    if (await this.isActive()) throw new ServiceStillActiveError('disable');
    await rm(this.unitPath, { force: true });
    await this.required('systemd reload', ['--user', 'daemon-reload']);
  }

  async probe(): Promise<ServiceProbe> {
    const [enabled, active, linger] = await Promise.all([
      this.runner('systemctl', ['--user', 'is-enabled', SERVICE_UNIT_NAME]),
      this.runner('systemctl', ['--user', 'is-active', SERVICE_UNIT_NAME]),
      this.runner('loginctl', [
        'show-user',
        String(this.uid),
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
  }

  async processId(): Promise<number | undefined> {
    const result = await this.runner('systemctl', [
      '--user',
      'show',
      SERVICE_UNIT_NAME,
      '--property=MainPID',
      '--value',
    ]);
    const pid = Number(result.stdout.trim());
    return result.code === 0 && Number.isSafeInteger(pid) && pid > 0
      ? pid
      : undefined;
  }

  async enableLinger(): Promise<boolean> {
    const result = await this.runner('loginctl', [
      'enable-linger',
      '--no-ask-password',
      String(this.uid),
    ]);
    return result.code === 0;
  }

  private async isActive(): Promise<boolean> {
    const result = await this.runner('systemctl', [
      '--user',
      'is-active',
      SERVICE_UNIT_NAME,
    ]);
    return result.code === 0;
  }

  private async required(
    description: string,
    args: readonly string[],
  ): Promise<void> {
    const result = await this.runner('systemctl', args);
    if (result.code !== 0)
      throw new ServiceCommandFailedError(
        description,
        result.stderr.trim() || `exit ${result.code}`,
      );
  }
}
