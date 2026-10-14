import {
  emptyDocuments,
  openDocument,
  type DocumentTabsState,
} from './document-tabs';

export type PaneId = 'left' | 'right';

export type DocumentPanes<T extends { key: string }> = {
  readonly left: DocumentTabsState<T>;
  readonly right: DocumentTabsState<T> | null;
  readonly focused: PaneId;
};

export function emptyPanes<T extends { key: string }>(): DocumentPanes<T> {
  return { left: emptyDocuments<T>(), right: null, focused: 'left' };
}

export function focusPane<T extends { key: string }>(
  state: DocumentPanes<T>,
  pane: PaneId,
): DocumentPanes<T> {
  return state[pane] ? { ...state, focused: pane } : state;
}

export function changePane<T extends { key: string }>(
  state: DocumentPanes<T>,
  pane: PaneId,
  change: (documents: DocumentTabsState<T>) => DocumentTabsState<T>,
): DocumentPanes<T> {
  const current = state[pane];
  if (!current) return state;
  const documents = change(current);
  if (documents.tabs.length === 0 && state.right) {
    return {
      left: pane === 'left' ? state.right : state.left,
      right: null,
      focused: 'left',
    };
  }
  return { ...state, [pane]: documents, focused: pane };
}

export function openInPane<T extends { key: string }>(
  state: DocumentPanes<T>,
  document: T,
  pane: PaneId = state.focused,
): DocumentPanes<T> {
  return {
    ...state,
    [pane]: openDocument(state[pane] ?? emptyDocuments<T>(), document),
    focused: pane,
  };
}

export function openToSide<T extends { key: string }>(
  state: DocumentPanes<T>,
  document: T,
  source: PaneId = state.focused,
): DocumentPanes<T> {
  return openInPane(state, document, source === 'left' ? 'right' : 'left');
}

export function visiblePanes<T extends { key: string }>(
  state: DocumentPanes<T>,
  width: number,
): readonly PaneId[] {
  return state.right && width >= 700 ? ['left', 'right'] : [state.focused];
}
