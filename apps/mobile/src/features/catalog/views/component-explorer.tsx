import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Box } from '../../../components/ui/box';
import { Item } from '../../../components/ui/item';
import { Separator } from '../../../components/ui/separator';
import { Text } from '../../../components/ui/text';
import { componentNames, type ComponentName } from './component-catalog';
import { ButtonPreview, TextPreview } from './component-library';
import { PrimitivePreview } from './primitive-preview';

export function ComponentExplorer() {
  const [selected, setSelected] = useState<ComponentName>('Text');
  const [width, setWidth] = useState(0);
  const sideBySide = width >= 640;
  return (
    <Box
      className={sideBySide ? 'flex-1 flex-row' : 'flex-1'}
      surface="background"
      onLayout={({ nativeEvent: { layout } }) => setWidth(layout.width)}
    >
      <Box className={sideBySide ? 'w-48 shrink-0' : 'h-48 shrink-0'}>
        <ScrollView
          className="flex-1"
          contentInsetAdjustmentBehavior="automatic"
        >
          <Box gap={1} padding={4}>
            <Text variant="subheading" tone="muted">
              Components
            </Text>
            {componentNames.map((name) => (
              <Item
                key={name}
                title={name}
                accessibilityLabel={`Explore ${name}`}
                selected={selected === name}
                onPress={() => setSelected(name)}
              />
            ))}
          </Box>
        </ScrollView>
      </Box>
      <Separator orientation={sideBySide ? 'vertical' : 'horizontal'} />
      <Box className="min-w-0 flex-1" surface="background">
        <SelectedPreview name={selected} />
      </Box>
    </Box>
  );
}

function SelectedPreview({ name }: { name: ComponentName }) {
  switch (name) {
    case 'Text':
      return <TextPreview />;
    case 'Button':
      return <ButtonPreview />;
    default:
      return <PrimitivePreview key={name} name={name} />;
  }
}
