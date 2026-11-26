import type { TabIconName } from '../shared/icons/icon';

export const appTabs = [
  {
    name: '(walkthrough)',
    root: 'walkthrough',
    title: 'Walkthrough',
    icon: 'walkthrough',
  },
  { name: '(changes)', root: 'changes', title: 'Changes', icon: 'changes' },
  { name: '(files)', root: 'files', title: 'Files', icon: 'files' },
  { name: '(history)', root: 'history', title: 'History', icon: 'history' },
] as const satisfies readonly {
  name: string;
  root: string;
  title: string;
  icon: TabIconName;
}[];

export type WorktreeTab = (typeof appTabs)[number]['root'];
