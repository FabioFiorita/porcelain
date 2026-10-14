import { Button, Menu, Toggle } from '@expo/ui/swift-ui';
import { ContentMenu } from '../../../components/ui/content-menu.ios';
import type { ComparisonMenuProps } from './comparison-menu-props';

export function ComparisonMenu({
  comparison,
  bases,
  onComparison,
}: ComparisonMenuProps) {
  return (
    <ContentMenu
      label={comparison.kind === 'worktree' ? 'Uncommitted' : 'Branch'}
    >
      <Toggle
        label="Uncommitted"
        isOn={comparison.kind === 'worktree'}
        onIsOnChange={() => onComparison({ kind: 'worktree' })}
      />
      <Toggle
        label="Branch"
        isOn={comparison.kind === 'branch'}
        onIsOnChange={() => onComparison({ kind: 'branch' })}
      />
      {comparison.kind === 'branch' ? (
        <Menu label="Compare against">
          <Button
            label="Default base"
            onPress={() => onComparison({ kind: 'branch' })}
          />
          {bases.map((base) => (
            <Toggle
              key={base.ref}
              label={base.name}
              isOn={comparison.base === base.ref}
              onIsOnChange={() =>
                onComparison({ kind: 'branch', base: base.ref })
              }
            />
          ))}
        </Menu>
      ) : null}
    </ContentMenu>
  );
}
