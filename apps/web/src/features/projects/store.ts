import { create } from 'zustand';

type ProjectBrowserState = {
  search: string;
  folderPath: string | undefined;
  setSearch: (search: string) => void;
  setFolderPath: (path: string | undefined) => void;
  reset: () => void;
};

export const useProjectBrowserStore = create<ProjectBrowserState>()((set) => ({
  search: '',
  folderPath: undefined,
  setSearch: (search) => set({ search }),
  setFolderPath: (folderPath) => set({ folderPath }),
  reset: () => set({ search: '', folderPath: undefined }),
}));
