export type FilePreference = { path: string; pinned: boolean; hidden: boolean };

export type FilePreferenceChange = {
  path: string;
  flag: 'pinned' | 'hidden';
  value: boolean;
};

export type FilePreferenceList = { preferences: FilePreference[] };

export type ListFilePreferencesInput = { projectId: string };

export type SetFilePreferenceInput = FilePreferenceChange & {
  projectId: string;
};
