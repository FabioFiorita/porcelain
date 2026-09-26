import type { FilePreference } from './file-preference.ts';

export type SetFilePreferenceInput = {
  projectId: string;
  path: string;
  flag: 'pinned' | 'hidden';
  value: boolean;
};

export type SetFilePreferenceResult = {
  preferences: FilePreference[];
  changed: boolean;
};

export type SetFilePreferenceOptions = { maxPreferences: number };
