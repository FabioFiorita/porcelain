export type CommitParentMenuProps = {
  parentOids: readonly string[];
  parent: number;
  onSelect: (parent: number) => void;
};
