import { useRouter, useSegments } from 'expo-router';
import type { IconName } from '../components/ui/icon';
import { Rail, RailItem } from '../components/ui/rail';
import { useWorktreeDrawer } from '../features/projects';
import { tabHref } from '../shared/rules/tab-href';
import type { TabIconName } from '../shared/icons/icon';
import { appTabs, type WorktreeTab } from './app-tab-list';

const sectionTestIds = {
  walkthrough: 'rail-walkthrough',
  changes: 'rail-changes',
  files: 'rail-files',
  history: 'rail-history',
} as const satisfies Record<WorktreeTab, string>;

const sectionIcons = {
  walkthrough: 'checklist',
  changes: 'changes',
  files: 'files',
  history: 'history',
} as const satisfies Record<TabIconName, IconName>;

function useSection(): WorktreeTab | undefined {
  const segments: readonly string[] = useSegments();
  return appTabs.find((tab) => segments.includes(tab.name))?.root;
}

function useOpenSection() {
  const router = useRouter();
  const drawer = useWorktreeDrawer();
  return (root: WorktreeTab) => {
    drawer.close();
    router.navigate(tabHref(root));
  };
}

export function SectionRail() {
  const section = useSection();
  const open = useOpenSection();
  return (
    <Rail>
      {appTabs.map((tab) => (
        <RailItem
          key={tab.name}
          testID={sectionTestIds[tab.root]}
          icon={sectionIcons[tab.icon]}
          label={tab.title}
          selected={section === tab.root}
          onPress={() => open(tab.root)}
        />
      ))}
    </Rail>
  );
}
