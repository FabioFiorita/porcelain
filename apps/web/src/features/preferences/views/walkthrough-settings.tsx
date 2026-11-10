import type { Connection } from '@/shared/workspace/connection';
import { WalkthroughWriterForm } from './walkthrough-writer-form';
import { FieldSet, FieldLegend, FieldDescription } from '@/components/ui/field';
export function WalkthroughSettings({
  connection,
}: {
  connection: Connection;
}) {
  return (
    <FieldSet>
      <FieldLegend variant="label">Default walkthrough writer</FieldLegend>
      <FieldDescription>
        Saved on this computer for manual and automatic walkthroughs. Each
        project can override this writer from its three-dot menu. Projects using
        the default follow later changes here.
      </FieldDescription>
      <WalkthroughWriterForm connection={connection} />
    </FieldSet>
  );
}
