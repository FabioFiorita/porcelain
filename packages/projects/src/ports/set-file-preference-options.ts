import { Context } from 'effect';
import type { SetFilePreferenceOptions as SetFilePreferenceOptionsShape } from '../models/set-file-preference.ts';
export const SetFilePreferenceOptions = Context.Service<
  '@porcelain/projects/SetFilePreferenceOptions',
  SetFilePreferenceOptionsShape
>('@porcelain/projects/SetFilePreferenceOptions');
