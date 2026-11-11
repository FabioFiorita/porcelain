export type SegmentedControlProps<Id extends string> = {
  options: readonly { readonly id: Id; readonly label: string }[];
  selected: Id;
  onSelect: (id: Id) => void;
  width?: 'fill' | 'content';
};
