import { Schema } from 'effect';

export const environmentIconSchema = Schema.Literals([
  'desktop',
  'laptop',
  'server',
  'cloud',
]);
type EnvironmentIcon = typeof environmentIconSchema.Type;

export type EnvironmentLabel = {
  name: string;
  custom: boolean;
  icon?: EnvironmentIcon;
};

export type ChosenEnvironmentLabel = {
  name: string | undefined;
  icon: EnvironmentIcon | undefined;
};
