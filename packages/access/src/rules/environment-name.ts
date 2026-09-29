import type {
  ChosenEnvironmentName,
  EnvironmentName,
} from '../models/environment-name.ts';

export function environmentName(
  chosen: ChosenEnvironmentName,
  hostName: string,
): EnvironmentName {
  return chosen.name === undefined
    ? { name: hostName, custom: false }
    : { name: chosen.name, custom: true };
}
