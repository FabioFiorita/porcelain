import { TabStack } from '../../../shell/tab-stack';

export const unstable_settings = {
  reviews: { anchor: 'index' },
  worktrees: { anchor: 'worktrees' },
};

export default function TabStackLayout({ segment }: { segment: string }) {
  return <TabStack segment={segment} />;
}
