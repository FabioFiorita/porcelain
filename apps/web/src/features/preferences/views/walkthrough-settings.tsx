import type { Connection } from '@/shared/workspace/connection';
import { WalkthroughWriterForm } from './walkthrough-writer-form';
import {
  SettingsGroup,
  SettingsSection,
} from '@/shared/views/settings-section';
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from '@/components/ui/item';
export function WalkthroughSettings({
  connection,
}: {
  connection: Connection;
}) {
  return (
    <SettingsSection id="walkthroughs" title="Walkthroughs">
      <SettingsGroup>
        <Item>
          <ItemContent className="min-w-0 basis-72">
            <ItemTitle>Default walkthrough writer</ItemTitle>
            <ItemDescription>
              Saved on this computer for manual and automatic walkthroughs. Each
              project can override this writer from its three-dot menu. Projects
              using the default follow later changes here.
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <WalkthroughWriterForm connection={connection} />
          </ItemActions>
        </Item>
      </SettingsGroup>
    </SettingsSection>
  );
}
