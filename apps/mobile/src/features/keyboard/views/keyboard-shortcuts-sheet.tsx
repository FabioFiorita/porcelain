import { Box } from '../../../components/ui/box';
import { CardRows } from '../../../components/ui/card';
import { GroupHeader } from '../../../components/ui/group-header';
import { Item } from '../../../components/ui/item';
import { Sheet } from '../../../components/ui/sheet';
import { Text } from '../../../components/ui/text';
import { keyShortcutSections } from '../../../shared/rules/key-commands';

export function KeyboardShortcutsSheet() {
  return (
    <Sheet title="Keyboard Shortcuts">
      <Box padding={4} gap={4} testID="keyboard-shortcuts">
        {keyShortcutSections().map((section) => (
          <Box key={section.title}>
            <GroupHeader label={section.title} variant="section" />
            <CardRows>
              {section.shortcuts.map((shortcut) => (
                <Item
                  key={shortcut.title}
                  size="compact"
                  title={shortcut.title}
                  accessibilityLabel={`${shortcut.title}, ${shortcut.keys.join(' or ')}`}
                  trailing={
                    <Text variant="code" tone="muted">
                      {shortcut.keys.join('  ')}
                    </Text>
                  }
                />
              ))}
            </CardRows>
          </Box>
        ))}
        <Text variant="caption" tone="muted">
          Hold Command on a hardware keyboard to see the shortcuts that work
          on the current screen. Arrow keys, J, K and Return move through the
          list you last used; Tab moves to the next list.
        </Text>
      </Box>
    </Sheet>
  );
}
