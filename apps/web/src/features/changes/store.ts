import { create } from 'zustand';

type RecoveryState = {
  attempted: Readonly<Record<string, string>>;
  pending: Readonly<Record<string, string>>;
  begin: (key: string, token: string) => boolean;
  finish: (key: string, token: string) => void;
};

export const useChangesStore = create<RecoveryState>()((set, get) => ({
  attempted: {},
  pending: {},
  begin(key, token) {
    if (get().attempted[key] === token) return false;
    set((state) => ({
      attempted: { ...state.attempted, [key]: token },
      pending: { ...state.pending, [key]: token },
    }));
    return true;
  },
  finish(key, token) {
    set((state) => {
      if (state.pending[key] !== token) return state;
      const pending = { ...state.pending };
      delete pending[key];
      return { pending };
    });
  },
}));
