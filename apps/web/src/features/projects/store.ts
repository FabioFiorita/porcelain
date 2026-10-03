import { create } from 'zustand';

type ProjectBrowserState = {
  folderPath: string | undefined;
  setFolderPath: (path: string | undefined) => void;
  reset: () => void;
};

export const useProjectBrowserStore = create<ProjectBrowserState>()((set) => ({
  folderPath: undefined,
  setFolderPath: (folderPath) => set({ folderPath }),
  reset: () => set({ folderPath: undefined }),
}));
