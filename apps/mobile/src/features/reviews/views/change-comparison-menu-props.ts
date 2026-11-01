export type ChangeComparisonMenuProps = {
  current: string | undefined;
  scopes: readonly string[];
  onScope: (scope: string) => void;
};
