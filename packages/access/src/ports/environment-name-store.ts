import type { ChosenEnvironmentName } from '../models/environment-name.ts';

export interface EnvironmentNameStore {
  read(): ChosenEnvironmentName;
  save(input: ChosenEnvironmentName): void;
}
