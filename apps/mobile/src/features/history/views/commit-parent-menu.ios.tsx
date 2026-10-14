import { Toggle } from '@expo/ui/swift-ui';
import { ContentMenu } from '../../../components/ui/content-menu.ios';
import { shortOid } from '@porcelain/client/history/rules';
import type { CommitParentMenuProps } from './commit-parent-menu-props';

export function CommitParentMenu({
  parentOids,
  parent,
  onSelect,
}: CommitParentMenuProps) {
  return (
    <ContentMenu label="Compare parent">
      {parentOids.map((oid, index) => (
        <Toggle
          key={oid}
          label={`Parent ${index + 1} · ${shortOid(oid)}`}
          isOn={parent === index + 1}
          onIsOnChange={() => onSelect(index + 1)}
        />
      ))}
    </ContentMenu>
  );
}
