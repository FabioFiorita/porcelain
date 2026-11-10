import type { Connection } from '@/shared/workspace/connection';
import { WalkthroughWriterForm } from './walkthrough-writer-form';
import { FieldSet, FieldLegend } from '@/components/ui/field';
import {
  Item,
  ItemGroup,
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
    <FieldSet>
      <FieldLegend variant="label">Walkthroughs</FieldLegend>
      <ItemGroup>
        <Item variant="outline">
          <ItemContent className="min-w-0">
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
      </ItemGroup>
    </FieldSet>
  );
}
