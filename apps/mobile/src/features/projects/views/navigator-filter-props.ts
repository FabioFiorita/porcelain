import type {
  NavigatorFilter,
  NavigatorFilterSection,
} from '@porcelain/client/projects/rules';

export type NavigatorFilterProps = {
  sections: readonly NavigatorFilterSection[];
  filter: NavigatorFilter;
  onChange: (filter: NavigatorFilter) => void;
};

export type NavigatorScopePickerProps = {
  section: NavigatorFilterSection;
  label: string;
  onChange: (next: readonly string[] | undefined) => void;
};
