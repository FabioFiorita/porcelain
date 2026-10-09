import type { ItemProps } from './item';

export type ItemMenuProps = ItemProps & {
  actions: readonly {
    id: string;
    label: string;
    onPress: () => void;
    disabled?: boolean;
  }[];
};
