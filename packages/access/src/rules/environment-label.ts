import type {
  ChosenEnvironmentLabel,
  EnvironmentLabel,
} from '../models/environment-label.ts';

export function environmentLabel(
  chosen: ChosenEnvironmentLabel,
  hostName: string,
): EnvironmentLabel {
  return {
    ...(chosen.name === undefined
      ? { name: hostName, custom: false }
      : { name: chosen.name, custom: true }),
    ...(chosen.icon === undefined ? {} : { icon: chosen.icon }),
  };
}
