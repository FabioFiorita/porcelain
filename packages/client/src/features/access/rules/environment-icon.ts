import {
  environmentIconSchema,
  type EnvironmentIcon,
} from '@porcelain/contracts/access';

export type { EnvironmentIcon };

export const environmentIcons: readonly EnvironmentIcon[] =
  environmentIconSchema.literals;

export const environmentIconLabels: Record<EnvironmentIcon, string> = {
  desktop: 'Desktop',
  laptop: 'Laptop',
  server: 'Server',
  cloud: 'Cloud',
};

const DEFAULT_ENVIRONMENT_ICON: EnvironmentIcon = 'desktop';

export function environmentIcon(environment: {
  icon?: EnvironmentIcon;
}): EnvironmentIcon {
  return environment.icon ?? DEFAULT_ENVIRONMENT_ICON;
}

export function chosenEnvironmentIcon(
  icon: EnvironmentIcon,
): EnvironmentIcon | null {
  return icon === DEFAULT_ENVIRONMENT_ICON ? null : icon;
}
