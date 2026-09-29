import { UPDATE_UNIT_NAME, unitArgument } from './systemd-unit.ts';

type UpdaterUnit = {
  nodeExecutable: string;
  entryPoint: string;
  searchPath: string;
};

export function updaterUnitArguments(unit: UpdaterUnit): string[] {
  const cli = [unit.nodeExecutable, unit.entryPoint, 'service'];
  return [
    '--user',
    `--unit=${UPDATE_UNIT_NAME}`,
    '--collect',
    '--quiet',
    `--property=ExecStopPost=${[...cli, 'recover'].map(unitArgument).join(' ')}`,
    `--setenv=PATH=${unit.searchPath}`,
    ...cli,
    'update',
  ];
}
