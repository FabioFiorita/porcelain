import { useRouter, useSegments } from 'expo-router';
import { Box } from '../components/ui/box';
import { Icon, type IconName } from '../components/ui/icon';
import { Item } from '../components/ui/item';
import { Rail, RailItem } from '../components/ui/rail';
import { useWorktreeDrawer } from '../features/projects';
import { tabHref } from '../shared/rules/tab-href';
import type { TabIconName } from '../shared/icons/icon';
import { appTabs, type WorktreeTab } from './app-tab-list';

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
          testID={`section-${tab.root}`}
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
          testID={`rail-${tab.root}`}
          icon={sectionIcons[tab.icon]}
          label={tab.title}
          selected={section === tab.root}
          onPress={() => open(tab.root)}
        />
      ))}
    </Rail>
  );
}
