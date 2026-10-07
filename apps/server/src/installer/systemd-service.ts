import { Effect, FileSystem, Path } from 'effect';
import type { CommandRunner } from './command-runner.ts';
import { ServiceCommandFailedError } from './errors/service-command-failed-error.ts';
import { ServiceStillActiveError } from './errors/service-still-active-error.ts';
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

export const openSystemdService = Effect.fn('Installer.openSystemdService')(
  function* (homeDirectory: string, uid: number, runner: CommandRunner) {
    const fs = yield* FileSystem.FileSystem;
    const pathApi = yield* Path.Path;
    const unitPath = pathApi.join(
      homeDirectory,
      '.config/systemd/user',
      SERVICE_UNIT_NAME,
    );
    const unitExists = Effect.fn('SystemdService.unitExists')(function* () {
      return yield* fs.exists(unitPath);
    });

    const write = Effect.fn('SystemdService.write')(function* (
      plan: ServicePlan,
    ) {
      yield* fs.makeDirectory(pathApi.dirname(unitPath), { recursive: true });
      yield* fs.writeFileString(unitPath, renderSystemdUnit(plan), {
        mode: 0o600,
      });
    });

    const enableAndStart = Effect.fn('SystemdService.enableAndStart')(
      function* () {
        yield* required('systemd reload', ['--user', 'daemon-reload']);
        yield* required('service start', [
          '--user',
          'enable',
          '--now',
          SERVICE_UNIT_NAME,
        ]);
      },
    );

    const start = Effect.fn('SystemdService.start')(function* () {
      yield* required('service start', ['--user', 'start', SERVICE_UNIT_NAME]);
    });

    const stop = Effect.fn('SystemdService.stop')(function* () {
      yield* required('service stop', ['--user', 'stop', SERVICE_UNIT_NAME]);
      if (yield* isActive())
        return yield* Effect.fail(
          new ServiceStillActiveError({ after: 'stop' }),
        );
    });

    const uninstall = Effect.fn('SystemdService.uninstall')(function* () {
      yield* required('service disable', [
        '--user',
        'disable',
        '--now',
        SERVICE_UNIT_NAME,
      ]);
      if (yield* isActive())
        return yield* Effect.fail(
          new ServiceStillActiveError({ after: 'disable' }),
        );
      yield* fs.remove(unitPath, { force: true });
      yield* required('systemd reload', ['--user', 'daemon-reload']);
    });

    const probe = Effect.fn('SystemdService.probe')(
      function* (): Effect.fn.Return<ServiceProbe> {
        const [enabled, active, linger] = yield* Effect.all([
          runner('systemctl', ['--user', 'is-enabled', SERVICE_UNIT_NAME]),
          runner('systemctl', ['--user', 'is-active', SERVICE_UNIT_NAME]),
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
    );

    const processId = Effect.fn('SystemdService.processId')(function* () {
      const result = yield* runner('systemctl', [
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
    });

    const enableLinger = Effect.fn('SystemdService.enableLinger')(function* () {
      const result = yield* runner('loginctl', [
        'enable-linger',
        '--no-ask-password',
        String(uid),
      ]);
      return result.code === 0;
    });

    const isActive = Effect.fn('SystemdService.isActive')(function* () {
      const result = yield* runner('systemctl', [
        '--user',
        'is-active',
        SERVICE_UNIT_NAME,
      ]);
      return result.code === 0;
    });

    const required = Effect.fn('SystemdService.required')(function* (
      description: string,
      args: readonly string[],
    ) {
      const result = yield* runner('systemctl', args);
      if (result.code !== 0)
        return yield* Effect.fail(
          new ServiceCommandFailedError({
            description: description,
            detail: result.stderr.trim() || `exit ${result.code}`,
          }),
        );
    });
    return {
      unitPath,
      unitExists,
      write,
      enableAndStart,
      start,
      stop,
      uninstall,
      probe,
      processId,
      enableLinger,
    };
  },
);

export type SystemdService = Effect.Success<
  ReturnType<typeof openSystemdService>
>;
