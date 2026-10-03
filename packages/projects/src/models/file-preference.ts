export type FilePreference = { path: string; pinned: boolean; hidden: boolean };

export type FilePreferenceKey = { projectId: string; path: string };

export type ProjectFilePreference = {
  projectId: string;
  preference: FilePreference;
};
