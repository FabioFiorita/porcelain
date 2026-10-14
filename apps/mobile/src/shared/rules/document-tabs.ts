export type DocumentTabsState<T extends { key: string }> = {
  readonly tabs: readonly T[];
  readonly active: string | null;
};

export function emptyDocuments<
  T extends { key: string },
>(): DocumentTabsState<T> {
  return { tabs: [], active: null };
}

export function openDocument<T extends { key: string }>(
  state: DocumentTabsState<T>,
  tab: T,
): DocumentTabsState<T> {
  return {
    tabs: state.tabs.some((entry) => entry.key === tab.key)
      ? state.tabs.map((entry) => (entry.key === tab.key ? tab : entry))
      : [...state.tabs, tab],
    active: tab.key,
  };
}

export function activateDocument<T extends { key: string }>(
  state: DocumentTabsState<T>,
  key: string,
): DocumentTabsState<T> {
  return state.tabs.some((tab) => tab.key === key)
    ? { ...state, active: key }
    : state;
}

export function closeDocument<T extends { key: string }>(
  state: DocumentTabsState<T>,
  key: string,
): DocumentTabsState<T> {
  const index = state.tabs.findIndex((tab) => tab.key === key);
  if (index === -1) return state;
  const tabs = state.tabs.filter((tab) => tab.key !== key);
  return {
    tabs,
    active:
      state.active === key
        ? (tabs[index]?.key ?? tabs[index - 1]?.key ?? null)
        : state.active,
  };
}
