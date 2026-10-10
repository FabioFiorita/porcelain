import { Card } from '../../../components/ui/card';
import { Box } from '../../../components/ui/box';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Text } from '../../../components/ui/text';
import { Button } from '../../../components/ui/button';

export function ComponentLibrary({
  onOpenText,
  onOpenButton,
  onOpenPrimitive,
}: {
  onOpenText: () => void;
  onOpenButton: () => void;
  onOpenPrimitive: (name: string) => void;
}) {
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Box gap={6} paddingX={6} paddingY={8}>
        <Text variant="heading">Component library</Text>
        <Text variant="ui" tone="muted">
          Open a primitive to inspect its variants.
        </Text>
        <Card gap={2} padding={4}>
          <Text variant="subheading">Text</Text>
          <Text variant="ui" tone="muted">
            Type scale, tones, weights and selection.
          </Text>
          <Button label="Explore Text" variant="outline" onPress={onOpenText} />
        </Card>
        <Card gap={2} padding={4}>
          <Text variant="subheading">Button</Text>
          <Text variant="ui" tone="muted">
            Variants, sizes, disabled and pending states.
          </Text>
          <Button
            label="Explore Button"
            variant="outline"
            onPress={onOpenButton}
          />
        </Card>
        {[
          'IconButton',
          'Input',
          'Badge',
          'Item',
          'States',
          'Files',
          'FileTree',
          'Review',
          'History',
          'CodeView',
          'DiffView',
          'MarkdownView',
          'ImageView',
          'HtmlPreview',
        ].map((name) => (
          <Button
            key={name}
            label={`Explore ${name}`}
            variant="outline"
            onPress={() => onOpenPrimitive(name)}
          />
        ))}
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
        <Text variant="heading">Button</Text>
        <Text variant="ui" accessibilityLiveRegion="polite">
          Actions: {actions}
        </Text>
      </Box>
      <ScrollView className="flex-1" contentInsetAdjustmentBehavior="automatic">
        <Box gap={6} paddingX={6} paddingBottom={8}>
          <Card gap={3} padding={4}>
            <Text variant="subheading" tone="muted">
              Variants
            </Text>
            <Button label="Default" onPress={act} />
            <Button label="Secondary" variant="secondary" onPress={act} />
            <Button label="Outline" variant="outline" onPress={act} />
            <Button label="Ghost" variant="ghost" onPress={act} />
            <Button label="Destructive" variant="destructive" onPress={act} />
            <Button label="Link" variant="link" onPress={act} />
          </Card>
          <Card gap={3} padding={4}>
            <Text variant="subheading" tone="muted">
              Sizes
            </Text>
            <Box className="flex-row items-center" gap={3}>
              <Button label="Regular" onPress={act} />
              <Button label="Small" size="sm" variant="outline" onPress={act} />
            </Box>
          </Card>
          <Card gap={3} padding={4}>
            <Text variant="subheading" tone="muted">
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
              variant="outline"
              disabled={!pending}
              onPress={() => setPending(false)}
            />
            <Button
              label="Reset actions"
              variant="ghost"
              onPress={() => setActions(0)}
            />
          </Card>
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
        <Text variant="heading">Text</Text>
        <Card gap={3} padding={4}>
          <Text variant="subheading" tone="muted">
            Type scale
          </Text>
          <Text variant="heading">Heading — Review changes</Text>
          <Text variant="subheading">Subheading — Changed files</Text>
          <Text>Body — Select a worktree to continue.</Text>
          <Text variant="ui">UI — Mark file as reviewed</Text>
          <Text variant="caption">Caption — Updated a minute ago</Text>
          <Text variant="small">Small — a050966 · main</Text>
          <Text variant="code">Code — const ready = true;</Text>
        </Card>
        <Card gap={3} padding={4}>
          <Text variant="subheading" tone="muted">
            Tones and weights
          </Text>
          <Text variant="ui">Default foreground</Text>
          <Text variant="ui" tone="muted">
            Muted metadata
          </Text>
          <Text variant="ui" tone="destructive">
            The environment is unavailable.
          </Text>
          <Text variant="ui" tone="card">
            Card foreground
          </Text>
          <Text variant="ui" weight="medium">
            Medium weight
          </Text>
          <Text variant="ui" weight="semibold">
            Semibold weight
          </Text>
        </Card>
        <Card gap={3} padding={4}>
          <Text variant="subheading" tone="muted">
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
