import { SplitView } from 'expo-router/unstable-split-view';
import { TabletSidebar } from './tablet-sidebar';
import { TabletContents } from './tablet-contents';

export function TabletSplit() {
  return (
    <SplitView
      preferredDisplayMode="twoBesideSecondary"
      preferredSplitBehavior="tile"
      displayModeButtonVisibility="always"
      topColumnForCollapsing="secondary"
    >
      <SplitView.Column>
        <TabletSidebar />
      </SplitView.Column>
      <SplitView.Column>
        <TabletContents />
      </SplitView.Column>
    </SplitView>
  );
}
