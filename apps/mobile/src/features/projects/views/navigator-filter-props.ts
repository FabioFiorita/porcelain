import type { NavigatorFilterSection } from '@porcelain/client/projects/rules';

export type NavigatorScopePickerProps = {
  section: NavigatorFilterSection;
  label: string;
  onChange: (next: readonly string[] | undefined) => void;
};
