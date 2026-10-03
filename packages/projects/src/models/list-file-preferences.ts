import type { FilePreference } from './file-preference.ts';

export type ListFilePreferencesInput = { projectId: string };

export type ListFilePreferencesResult = { preferences: FilePreference[] };
