export type FileActionMenuProps = {
  label: string;
  actions: readonly {
    id: 'diff' | 'files' | 'history';
    label: string;
    onPress: () => void;
  }[];
};
