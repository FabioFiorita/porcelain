import { useRouter, useSegments } from 'expo-router';
import { Box } from '../components/ui/box';
import { Icon, type IconName } from '../components/ui/icon';
import { Item } from '../components/ui/item';
import { Rail, RailItem } from '../components/ui/rail';
import { useWorktreeDrawer } from '../features/projects';
import { tabHref } from '../shared/rules/tab-href';
import type { TabIconName } from '../shared/icons/icon';
import { appTabs, type WorktreeTab } from './app-tab-list';

const sectionTestIds = {
  walkthrough: { item: 'section-walkthrough', rail: 'rail-walkthrough' },
  changes: { item: 'section-changes', rail: 'rail-changes' },
  files: { item: 'section-files', rail: 'rail-files' },
  history: { item: 'section-history', rail: 'rail-history' },
} as const satisfies Record<WorktreeTab, { item: string; rail: string }>;

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

export function SidebarSections() {
  const section = useSection();
  const open = useOpenSection();
  return (
    <Box paddingX={2} gap={1} accessibilityRole="tablist">
      {appTabs.map((tab) => (
        <Item
          key={tab.name}
          testID={sectionTestIds[tab.root].item}
          size="compact"
          title={tab.title}
          selected={section === tab.root}
          selectionTone="neutral"
          leading={
            <Icon
              name={sectionIcons[tab.icon]}
              tone={section === tab.root ? 'default' : 'muted'}
            />
          }
          onPress={() => open(tab.root)}
        />
      ))}
    </Box>
  );
}

export function SectionRail() {
  const section = useSection();
  const open = useOpenSection();
  return (
    <Rail>
      {appTabs.map((tab) => (
        <RailItem
          key={tab.name}
          testID={sectionTestIds[tab.root].rail}
          icon={sectionIcons[tab.icon]}
          label={tab.title}
          selected={section === tab.root}
          onPress={() => open(tab.root)}
        />
      ))}
    </Rail>
  );
}
