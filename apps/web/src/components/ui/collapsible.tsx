import type * as React from 'react';
import {
  Collapsible as CollapsibleRoot,
  CollapsiblePanel,
  CollapsibleTrigger as CollapsibleTriggerPrimitive,
} from '@ui-sdk/react/collapsible';

function Collapsible(props: React.ComponentProps<typeof CollapsibleRoot>) {
  return <CollapsibleRoot data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger(
  props: React.ComponentProps<typeof CollapsibleTriggerPrimitive>,
) {
  return (
    <CollapsibleTriggerPrimitive data-slot="collapsible-trigger" {...props} />
  );
}

function CollapsibleContent(
  props: React.ComponentProps<typeof CollapsiblePanel>,
) {
  return <CollapsiblePanel data-slot="collapsible-content" {...props} />;
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
