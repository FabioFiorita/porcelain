import { Card } from '../../../components/ui/card';
import { Box } from '../../../components/ui/box';
import { Fragment, useState } from 'react';
import { ScrollView } from 'react-native';
import { Text } from '../../../components/ui/text';
import { Button } from '../../../components/ui/button';
import { Icon } from '../../../components/ui/icon';
import { IconButton } from '../../../components/ui/icon-button';
import { Item } from '../../../components/ui/item';
import { Separator } from '../../../components/ui/separator';
import { primitiveNames } from './component-catalog';

export function ComponentLibrary({
  onOpenText,
  onOpenButton,
  onOpenPrimitive,
}: {
  onOpenText: () => void;
  onOpenButton: () => void;
  onOpenPrimitive: (name: string) => void;
}) {
  const chevron = <Icon name="chevron" tone="muted" />;
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Box gap={4} paddingX={4} paddingY={8}>
        <Box gap={1} paddingX={4}>
          <Text variant="largeTitle">Component library</Text>
          <Text variant="secondary" tone="muted">
            Open a primitive to inspect its variants.
          </Text>
        </Box>
        <Card>
          <Item
            title="Text"
            description="Type scale, tones, weights and selection."
            accessibilityLabel="Explore Text"
            trailing={chevron}
            onPress={onOpenText}
          />
          <Separator inset="content" />
          <Item
            title="Button"
            description="Filled, tonal, plain, destructive and icon buttons."
            accessibilityLabel="Explore Button"
            trailing={chevron}
            onPress={onOpenButton}
          />
          {primitiveNames.map((name) => (
            <Fragment key={name}>
              <Separator inset="content" />
              <Item
                title={name}
                accessibilityLabel={`Explore ${name}`}
                trailing={chevron}
                onPress={() => onOpenPrimitive(name)}
              />
            </Fragment>
          ))}
        </Card>
      </Box>
    </ScrollView>
  );
}

export function ButtonPreview() {
  const [actions, setActions] = useState(0);
  const [pending, setPending] = useState(false);
  const act = () => setActions((count) => count + 1);
  return (
    <Box className="flex-1" surface="background">
      <Box gap={2} paddingX={6} paddingY={4}>
        <Text variant="title">Button</Text>
        <Text variant="secondary" accessibilityLiveRegion="polite">
          Actions: {actions}
        </Text>
      </Box>
      <ScrollView className="flex-1" contentInsetAdjustmentBehavior="automatic">
        <Box gap={6} paddingX={6} paddingBottom={8}>
          <Box gap={3}>
            <Text variant="headline" tone="muted">
              Variants
            </Text>
            <Button label="Filled" onPress={act} />
            <Button label="Tonal" variant="tonal" onPress={act} />
            <Button label="Plain" variant="plain" onPress={act} />
            <Button label="Destructive" variant="destructive" onPress={act} />
            <Button
              label="Destructive plain"
              variant="destructivePlain"
              onPress={act}
            />
          </Box>
          <Box gap={3}>
            <Text variant="headline" tone="muted">
              Sizes
            </Text>
            <Box className="flex-row flex-wrap items-center" gap={3}>
              <Button label="Regular" onPress={act} />
              <Button label="Small" size="sm" onPress={act} />
              <Button
                label="Small tonal"
                size="sm"
                variant="tonal"
                onPress={act}
              />
            </Box>
          </Box>
          <Box gap={3}>
            <Text variant="headline" tone="muted">
              Icon buttons
            </Text>
            <Box className="flex-row flex-wrap items-center" gap={2}>
              <IconButton
                icon="more"
                accessibilityLabel="Plain icon"
                onPress={act}
              />
              <IconButton
                icon="collapse"
                size="sm"
                accessibilityLabel="Small plain icon"
                onPress={act}
              />
              <IconButton
                icon="comment"
                variant="tonal"
                accessibilityLabel="Tonal icon"
                onPress={act}
              />
              <IconButton
                icon="send"
                variant="filled"
                accessibilityLabel="Filled icon"
                onPress={act}
              />
            </Box>
          </Box>
          <Box gap={3}>
            <Text variant="headline" tone="muted">
              Disabled and pending
            </Text>
            <Button label="Disabled" disabled onPress={act} />
            <Button
              label={pending ? 'Working…' : 'Start pending demo'}
              pending={pending}
              onPress={() => {
                act();
                setPending(true);
              }}
            />
            <Button
              label="Finish pending demo"
              variant="tonal"
              disabled={!pending}
              onPress={() => setPending(false)}
            />
            <Button
              label="Reset actions"
              variant="plain"
              onPress={() => setActions(0)}
            />
          </Box>
        </Box>
      </ScrollView>
    </Box>
  );
}

export function TextPreview() {
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Box gap={6} paddingX={6} paddingY={8}>
        <Text variant="title">Text</Text>
        <Card gap={3} padding={4}>
          <Text variant="headline" tone="muted">
            Type scale
          </Text>
          <Text variant="largeTitle">Large title — Reviews</Text>
          <Text variant="title">Title — Review changes</Text>
          <Text variant="headline">Headline — Changed files</Text>
          <Text>Body — Select a worktree to continue.</Text>
          <Text variant="secondary">Secondary — Mark file as reviewed</Text>
          <Text variant="caption">Caption — Updated a minute ago</Text>
          <Text variant="code">Code — const ready = true;</Text>
        </Card>
        <Card gap={3} padding={4}>
          <Text variant="headline" tone="muted">
            Tones and weights
          </Text>
          <Text variant="secondary">Default foreground</Text>
          <Text variant="secondary" tone="muted">
            Muted metadata
          </Text>
          <Text variant="secondary" tone="destructive">
            The environment is unavailable.
          </Text>
          <Text variant="secondary" weight="medium">
            Medium weight
          </Text>
          <Text variant="secondary" weight="semibold">
            Semibold weight
          </Text>
        </Card>
        <Card gap={3} padding={4}>
          <Text variant="headline" tone="muted">
            Wrapping and selection
          </Text>
          <Text selectable>
            Long press to select and copy this text. Longer content wraps
            naturally within the available width and follows the device text
            size.
          </Text>
          <Text variant="caption" tone="muted">
            Selection is opt-in; device font scaling stays enabled.
          </Text>
        </Card>
      </Box>
    </ScrollView>
  );
}
