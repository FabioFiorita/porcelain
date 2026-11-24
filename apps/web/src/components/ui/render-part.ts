import type * as React from 'react';
import {
  mergeProps,
  renderElement,
  type RenderProp,
} from '@ui-sdk/react/primitive';

type PartState = Readonly<Record<string, string | boolean | null | undefined>>;

type PartElementProps<Tag extends keyof React.JSX.IntrinsicElements> =
  React.ComponentProps<Tag> & { render?: RenderProp<PartState> | undefined };

function stateAttributes(state: PartState) {
  const attributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(state)) {
    if (value === true) attributes[`data-${key.toLowerCase()}`] = '';
    else if (value) attributes[`data-${key.toLowerCase()}`] = value;
  }
  return attributes;
}

function renderPart({
  defaultTagName,
  props,
  render,
  state,
}: {
  defaultTagName: keyof React.JSX.IntrinsicElements;
  props: Record<string, unknown>;
  render: RenderProp<PartState> | undefined;
  state: PartState;
}) {
  return renderElement(
    defaultTagName,
    mergeProps(stateAttributes(state), props),
    render,
    state,
  );
}

function RenderInto({
  render,
  ...props
}: {
  render: RenderProp<PartState>;
  ref?: React.Ref<HTMLElement> | undefined;
}) {
  return renderPart({ defaultTagName: 'span', props, render, state: {} });
}

export { mergeProps, RenderInto, renderPart, type PartElementProps };
