export type ProjectActionMenuProps = {
  label: string;
  actions: readonly {
    id: 'copy' | 'rename' | 'remove';
    label: string;
    onPress: () => void;
    destructive?: boolean;
  }[];
};
