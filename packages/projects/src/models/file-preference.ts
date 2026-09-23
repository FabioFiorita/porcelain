export type FilePreference = { path: string; pinned: boolean; hidden: boolean };
export type FilePreferenceChange = {
  path: string;
  flag: 'pinned' | 'hidden';
  value: boolean;
};
