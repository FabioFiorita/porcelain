import { useState } from 'react';
import { ScrollView, View } from 'react-native';
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
      <View className="gap-6 px-6 py-8">
        <Text variant="heading">Component library</Text>
        <Text variant="ui" tone="muted">
          Open a primitive to inspect its variants.
        </Text>
        <View className="gap-2 rounded-lg border border-border bg-card p-4">
          <Text variant="subheading">Text</Text>
          <Text variant="ui" tone="muted">
            Type scale, tones, weights and selection.
          </Text>
          <Button label="Explore Text" variant="outline" onPress={onOpenText} />
        </View>
        <View className="gap-2 rounded-lg border border-border bg-card p-4">
          <Text variant="subheading">Button</Text>
          <Text variant="ui" tone="muted">
            Variants, sizes, disabled and pending states.
          </Text>
          <Button
            label="Explore Button"
            variant="outline"
            onPress={onOpenButton}
          />
        </View>
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
      </View>
    </ScrollView>
  );
}

export function ButtonPreview() {
  const [actions, setActions] = useState(0);
  const [pending, setPending] = useState(false);
  const act = () => setActions((count) => count + 1);
  return (
    <View className="flex-1 bg-background">
      <View className="gap-2 px-6 py-4">
        <Text variant="heading">Button</Text>
        <Text variant="ui" accessibilityLiveRegion="polite">
          Actions: {actions}
        </Text>
      </View>
      <ScrollView className="flex-1" contentInsetAdjustmentBehavior="automatic">
        <View className="gap-6 px-6 pb-8">
          <View className="gap-3 rounded-lg border border-border bg-card p-4">
            <Text variant="subheading" tone="muted">
              Variants
            </Text>
            <Button label="Default" onPress={act} />
            <Button label="Secondary" variant="secondary" onPress={act} />
            <Button label="Outline" variant="outline" onPress={act} />
            <Button label="Ghost" variant="ghost" onPress={act} />
            <Button label="Destructive" variant="destructive" onPress={act} />
            <Button label="Link" variant="link" onPress={act} />
          </View>
          <View className="gap-3 rounded-lg border border-border bg-card p-4">
            <Text variant="subheading" tone="muted">
              Sizes
            </Text>
            <View className="flex-row items-center gap-3">
              <Button label="Regular" onPress={act} />
              <Button label="Small" size="sm" variant="outline" onPress={act} />
            </View>
          </View>
          <View className="gap-3 rounded-lg border border-border bg-card p-4">
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
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export function TextPreview() {
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
    >
      <View className="gap-6 px-6 py-8">
        <Text variant="heading">Text</Text>
        <View className="gap-3 rounded-lg border border-border bg-card p-4">
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
        </View>
        <View className="gap-3 rounded-lg border border-border bg-card p-4">
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
        </View>
        <View className="gap-3 rounded-lg border border-border bg-card p-4">
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
        </View>
      </View>
    </ScrollView>
  );
}
