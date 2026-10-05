import { Context } from 'effect';
import type { ChosenEnvironmentName } from '../models/environment-name.ts';

export interface EnvironmentNameStore {
  read(): ChosenEnvironmentName;
  save(input: ChosenEnvironmentName): void;
}

export const EnvironmentNameStore = Context.Service<
  '@porcelain/access/EnvironmentNameStore',
  EnvironmentNameStore
>('@porcelain/access/EnvironmentNameStore');
