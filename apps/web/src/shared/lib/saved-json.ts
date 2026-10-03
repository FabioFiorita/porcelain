type SavedStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function savedJson<S>(
  storage: () => SavedStorage,
  read: (saved: unknown) => S,
) {
  return {
    getItem(name: string): { state: S } | null {
      let raw: string | null;
      try {
        raw = storage().getItem(name);
      } catch {
        return null;
      }
      if (raw == null) return null;
      let saved: unknown;
      try {
        saved = JSON.parse(raw);
      } catch {
        saved = null;
      }
      return { state: read(saved) };
    },
    setItem(name: string, value: { state: S }) {
      try {
        storage().setItem(name, JSON.stringify(value.state));
      } catch {
        return;
      }
    },
    removeItem(name: string) {
      try {
        storage().removeItem(name);
      } catch {
        return;
      }
    },
  };
}
