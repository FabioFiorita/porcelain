import { useState, lazy, Suspense } from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '../../../components/ui/text';
import { IconButton } from '../../../components/ui/icon-button';
import { Input } from '../../../components/ui/input';
import { Field } from '../../../components/ui/field';
import { Badge } from '../../../components/ui/badge';
import { Item } from '../../../components/ui/item';
import { Separator } from '../../../components/ui/separator';
import { Empty } from '../../../components/ui/empty';
import { Loading } from '../../../components/ui/loading';
import { ErrorState } from '../../../components/ui/error-state';
import { Icon } from '../../../components/ui/icon';
import { Button } from '../../../components/ui/button';
import { FileHeader } from '../../../components/ui/file-header';
import { FileNotice } from '../../../components/ui/file-notice';
import { FileTree } from '../../../components/ui/file-tree';
import { ReviewAnnotation } from '../../../components/ui/review-annotation';
import { ReviewComposer } from '../../../components/ui/review-composer';
import { HistoryList } from '../../../components/ui/history-list';
const NativePreview = lazy(() => import('./native-preview'));

export function PrimitivePreview({ name }: { name: string }) {
  const [actions, setActions] = useState(0);
  const [value, setValue] = useState('');
  const [expanded, setExpanded] = useState(new Set(['src']));
  const [selected, setSelected] = useState('');
  const [resolved, setResolved] = useState(false);
  if (
    [
      'CodeView',
      'DiffView',
      'MarkdownView',
      'ImageView',
      'HtmlPreview',
    ].includes(name)
  )
    return (
      <Suspense fallback={<Loading />}>
        <NativePreview name={name} />
      </Suspense>
    );
  if (name === 'FileTree')
    return (
      <View className="flex-1 bg-background">
        <View className="p-6">
          <Text variant="heading">FileTree</Text>
        </View>
        <View className="px-6">
          <Text variant="ui">Selected: {selected || 'none'}</Text>
          <Text variant="caption">Menu action: {value || 'none'}</Text>
        </View>
        <FileTree
          nodes={[
            {
              id: 'src',
              name: 'src/components',
              kind: 'folder',
              children: [
                { id: 'button', name: 'button.tsx', kind: 'code', status: 'M' },
                { id: 'input', name: 'input.tsx', kind: 'code', status: 'A' },
              ],
            },
            { id: 'readme', name: 'README.md', kind: 'file' },
          ]}
          expanded={expanded}
          selected={selected}
          onSelect={setSelected}
          contextMenu={(node) => [
            {
              id: 'open',
              label:
                node.kind === 'folder'
                  ? expanded.has(node.id)
                    ? 'Collapse folder'
                    : 'Expand folder'
                  : 'Open file',
              onPress: () => {
                if (node.kind === 'folder') {
                  setExpanded((current) => {
                    const next = new Set(current);
                    if (next.has(node.id)) next.delete(node.id);
                    else next.add(node.id);
                    return next;
                  });
                } else setSelected(node.id);
                setValue(`Open ${node.name}`);
              },
            },
            {
              id: 'details',
              label: 'Show details',
              onPress: () =>
                setValue(`${node.name} · ${node.status ?? 'Unchanged'}`),
            },
          ]}
          onToggle={(id) =>
            setExpanded((current) => {
              const next = new Set(current);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
        />
      </View>
    );
  if (name === 'History')
    return (
      <View className="flex-1 bg-background">
        <View className="p-6">
          <Text variant="heading">History</Text>
        </View>
        <HistoryList
          entries={[
            {
              id: 'one',
              subject: 'Add mobile primitives',
              author: 'Developer',
              time: '2 minutes ago',
              shortHash: 'a050966',
              refs: ['main'],
            },
            {
              id: 'two',
              subject: 'Keep native navigation',
              author: 'Developer',
              time: '1 hour ago',
              shortHash: '9be243a',
            },
          ]}
          selected={selected}
          onSelect={setSelected}
        />
      </View>
    );
  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="interactive"
      className="flex-1 bg-background"
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      <View className="gap-6 px-6 py-8">
        <Text variant="heading">{name}</Text>
        {name === 'Badge' ? (
          <View className="flex-row flex-wrap gap-3">
            {(['default', 'secondary', 'outline', 'destructive'] as const).map(
              (variant) => (
                <Badge key={variant} label={variant} variant={variant} />
              ),
            )}
          </View>
        ) : null}
        {name === 'Item' ? (
          <>
            <Text variant="ui">Actions: {actions}</Text>
            <Item
              title="Default item"
              description="A title with supporting text"
              leading={<Icon name="file" />}
              trailing={<Badge label="Modified" variant="secondary" />}
              onPress={() => setActions(actions + 1)}
            />
            <Separator />
            <Item
              title="Selected item"
              selected
              variant="outline"
              onPress={() => setActions(actions + 1)}
            />
            <Item
              title="Disabled item"
              disabled
              onPress={() => setActions(actions + 1)}
            />
            <Item title="Compact item" size="xs" variant="muted" />
          </>
        ) : null}
        {name === 'States' ? (
          <>
            <Loading label="Loading example…" />
            <ErrorState
              message="The environment could not be reached."
              retry={{
                label: 'Retry example',
                onPress: () => setActions(actions + 1),
              }}
            />
            <Text variant="ui">Retries: {actions}</Text>
            <Empty
              icon="folder"
              title="No changed files"
              description="Your worktree is clean."
              action={{
                label: 'Refresh example',
                onPress: () => setActions(actions + 1),
              }}
            />
          </>
        ) : null}
        {name === 'Files' ? (
          <>
            <View className="-mx-4">
              <FileHeader
                path="apps/mobile/src/components/ui/button.tsx"
                status="Modified"
                additions={12}
                deletions={4}
                reviewed
                actions={
                  <Button
                    label="File action"
                    size="sm"
                    variant="ghost"
                    onPress={() => setActions(actions + 1)}
                  />
                }
              />
            </View>
            <FileNotice kind="binary" />
            <FileNotice kind="unsupported" />
            <FileNotice kind="unavailable" />
            <FileNotice kind="oversized" />
          </>
        ) : null}
        {name === 'Review' ? (
          <>
            <ReviewAnnotation
              author="reviewer"
              body="This should use the shared input primitive."
              label="+12 to +14"
              resolved={resolved}
              onResolve={() => setResolved(true)}
            />
            <ReviewComposer
              value={value}
              onChangeText={setValue}
              label="+12 to +14"
              onSubmit={() => {
                setActions(actions + 1);
                setValue('');
              }}
              onCancel={() => setValue('')}
            />
            <Text variant="ui">Comments: {actions}</Text>
          </>
        ) : null}
        {name === 'IconButton' ? (
          <>
            <Text variant="ui">Actions: {actions}</Text>
            <View className="flex-row gap-3">
              <IconButton
                icon="add"
                accessibilityLabel="Add example"
                variant="default"
                onPress={() => setActions(actions + 1)}
              />
              <IconButton
                icon="copy"
                accessibilityLabel="Copy example"
                variant="outline"
                onPress={() => setActions(actions + 1)}
              />
              <IconButton
                icon="close"
                accessibilityLabel="Disabled example"
                disabled
                onPress={() => setActions(actions + 1)}
              />
              <IconButton
                icon="check"
                accessibilityLabel="Pending example"
                pending
                onPress={() => setActions(actions + 1)}
              />
            </View>
          </>
        ) : null}
        {name === 'Input' ? (
          <>
            <Field label="Name" description="An editable single-line field.">
              <Input
                accessibilityLabel="Name"
                placeholder="Name"
                value={value}
                onChangeText={setValue}
              />
            </Field>
            <Text variant="ui">Value: {value || 'empty'}</Text>
            <Field label="Comment">
              <Input
                accessibilityLabel="Comment"
                placeholder="Share feedback…"
                multiline
              />
            </Field>
            <Field label="Invalid field" error="This field needs a value.">
              <Input accessibilityLabel="Invalid field" invalid />
            </Field>
            <Field label="Disabled field">
              <Input
                accessibilityLabel="Disabled field"
                value="Cannot edit"
                disabled
              />
            </Field>
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}
